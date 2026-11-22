import { useEffect, useRef, useState } from "react";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "flowbite-react";
import { api } from "../api";
import type { Order } from "../domain";
import OrderDetail, { orderDate } from "./OrderDetail";

interface Member {
  id: number;
  username: string;
  name: string;
  role: "admin" | "customer";
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}
interface MemberDetail extends Member {
  email: string;
  phone: string;
  address: string;
}
interface MemberList {
  total: number;
  members: Member[];
}

function joinedAt(value: string) {
  // SQLite CURRENT_TIMESTAMP stores UTC without an explicit timezone.
  return orderDate(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export default function MemberManagement({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<MemberList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);
  const [action, setAction] = useState<{
    member: Member;
    kind: "status" | "role";
    value: boolean;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const actionPending = useRef(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const actionLabel =
    action?.kind === "status"
      ? action.value
        ? "정지 해제"
        : "계정 정지"
      : action?.value
        ? "관리자 권한 부여"
        : "관리자 권한 회수";

  function confirmAction(
    member: Member,
    kind: "status" | "role",
    value: boolean,
  ) {
    setActionError("");
    setMessage("");
    setAction({ member, kind, value });
  }

  async function applyAction() {
    if (!action || actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    setActionError("");
    try {
      const updated = await api<MemberDetail>(
        `/admin/members/${action.member.id}/${action.kind}`,
        "PATCH",
        action.kind === "status"
          ? { isActive: action.value }
          : { isAdmin: action.value },
      );
      setList(
        (previous) =>
          previous && {
            ...previous,
            members: previous.members.map((member) =>
              member.id === updated.id
                ? {
                    ...member,
                    isAdmin: updated.isAdmin,
                    isActive: updated.isActive,
                    role: updated.role,
                  }
                : member,
            ),
          },
      );
      setDetail((previous) =>
        previous?.id === updated.id ? updated : previous,
      );
      setMessage(`${updated.username}님의 ${actionLabel} 처리를 완료했습니다.`);
      setAction(null);
      setRetry((value) => value + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "변경에 실패했습니다.");
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await api<MemberList>(
          `/admin/members?q=${encodeURIComponent(search)}`,
        );
        if (active) setList(result);
      } catch (e) {
        if (active) {
          setList(null);
          setError(
            e instanceof Error ? e.message : "회원 목록을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [search, retry]);

  useEffect(() => {
    if (selected === null) return;
    let active = true;
    async function load() {
      setDetailLoading(true);
      setDetailError("");
      try {
        const [member, history] = await Promise.all([
          api<MemberDetail>(`/admin/members/${selected}`),
          api<Order[]>(`/admin/members/${selected}/orders`),
        ]);
        if (active) {
          setDetail(member);
          setOrders(history);
        }
      } catch (e) {
        if (active)
          setDetailError(
            e instanceof Error ? e.message : "회원 정보를 불러오지 못했습니다.",
          );
      } finally {
        if (active) setDetailLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [selected, detailRetry]);

  function openMember(id: number) {
    setDetail(null);
    setOrders([]);
    setDetailError("");
    setDetailLoading(true);
    setSelected(id);
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>회원 관리</h1>
          <p className="page-description">
            회원 정보를 확인하고 회원별 주문 내역을 조회하세요.
          </p>
        </div>
      </div>
      <div className="admin-stats">
        <div>
          <span>전체 회원</span>
          <strong>
            {list?.total ?? "—"}
            <small>명</small>
          </strong>
        </div>
      </div>
      <form
        className="management-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(query.trim());
          setRetry((value) => value + 1);
        }}
      >
        <input
          className="admin-search"
          aria-label="회원 검색"
          placeholder="아이디 · 이름 검색"
          maxLength={100}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="secondary-button" type="submit">
          검색
        </button>
        <span>{loading ? "조회 중…" : `${list?.members.length ?? 0}명`}</span>
      </form>
      {message && (
        <p className="inline-notice" role="status">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">회원 목록을 불러오는 중…</p>
      ) : error ? (
        <div>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="secondary-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>아이디</th>
                <th>이름</th>
                <th>권한</th>
                <th>계정 상태</th>
                <th>가입일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {list?.members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <button
                      className="order-id"
                      onClick={() => openMember(member.id)}
                    >
                      {member.username}
                    </button>
                  </td>
                  <td>{member.name}</td>
                  <td>
                    <span className="status-pill">
                      {member.role === "admin" ? "관리자" : "일반 회원"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${member.isActive ? "" : "soldout"}`}
                    >
                      {member.isActive ? "활성" : "정지"}
                    </span>
                  </td>
                  <td>{joinedAt(member.createdAt)}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => openMember(member.id)}
                    >
                      상세 · 주문 내역
                    </button>
                    {!member.isAdmin && (
                      <button
                        type="button"
                        className={`text-button ${member.isActive ? "delete" : ""}`}
                        disabled={
                          actionBusy || String(member.id) === currentUserId
                        }
                        onClick={() =>
                          confirmAction(member, "status", !member.isActive)
                        }
                      >
                        {member.isActive ? "계정 정지" : "정지 해제"}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`text-button ${member.isAdmin ? "delete" : ""}`}
                      disabled={
                        actionBusy ||
                        String(member.id) === currentUserId ||
                        !member.isActive
                      }
                      title={
                        String(member.id) === currentUserId
                          ? "자신의 관리자 권한은 회수할 수 없습니다."
                          : !member.isActive
                            ? "정지를 먼저 해제해 주세요."
                            : undefined
                      }
                      onClick={() =>
                        confirmAction(member, "role", !member.isAdmin)
                      }
                    >
                      {member.isAdmin ? "관리자 권한 회수" : "관리자 권한 부여"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list?.members.length && (
            <p className="empty-state">
              {search ? "검색된 회원이 없습니다." : "등록된 회원이 없습니다."}
            </p>
          )}
        </div>
      )}
      <p className="admin-footnote">
        관리자 계정을 포함한 등록 회원 목록입니다. 연락처와 주소는 회원 상세에서
        확인할 수 있습니다.
      </p>
      <Modal
        show={selected !== null}
        onClose={() => setSelected(null)}
        size="3xl"
      >
        <ModalHeader>회원 상세 · 주문 내역</ModalHeader>
        <ModalBody>
          {detailLoading ? (
            <p role="status">회원 정보를 불러오는 중…</p>
          ) : detailError ? (
            <div>
              <p className="form-error" role="alert">
                {detailError}
              </p>
              <button
                className="secondary-button"
                onClick={() => setDetailRetry((value) => value + 1)}
              >
                다시 시도
              </button>
            </div>
          ) : (
            detail && (
              <>
                <section className="checkout-section">
                  <h2>{detail.name}님</h2>
                  <dl className="detail-specs">
                    <div>
                      <dt>아이디</dt>
                      <dd>{detail.username}</dd>
                    </div>
                    <div>
                      <dt>권한</dt>
                      <dd>
                        {detail.role === "admin" ? "관리자" : "일반 회원"}
                      </dd>
                    </div>
                    <div>
                      <dt>가입일</dt>
                      <dd>{joinedAt(detail.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>계정 상태</dt>
                      <dd>{detail.isActive ? "활성" : "정지"}</dd>
                    </div>
                    <div>
                      <dt>이메일</dt>
                      <dd>{detail.email || "미등록"}</dd>
                    </div>
                    <div>
                      <dt>전화번호</dt>
                      <dd>{detail.phone || "미등록"}</dd>
                    </div>
                    <div>
                      <dt>주소</dt>
                      <dd>{detail.address || "미등록"}</dd>
                    </div>
                  </dl>
                </section>
                <section className="checkout-section">
                  <h2>회원 주문 내역 ({orders.length}건)</h2>
                  {orders.length ? (
                    orders.map((order) => (
                      <details key={order.id} className="checkout-section">
                        <summary>
                          {order.id} · 주문 {order.status} · 결제{" "}
                          {order.paymentStatus} · 배송{" "}
                          {order.shippingStatus ?? "미등록"}
                        </summary>
                        <OrderDetail order={order} />
                      </details>
                    ))
                  ) : (
                    <p>아직 주문 내역이 없습니다.</p>
                  )}
                </section>
              </>
            )
          )}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelected(null)}
          >
            닫기
          </button>
        </ModalFooter>
      </Modal>
      <Modal
        show={action !== null}
        onClose={() => {
          if (!actionPending.current) setAction(null);
        }}
        size="md"
      >
        <ModalHeader>{actionLabel}</ModalHeader>
        <ModalBody>
          <p>
            ‘{action?.member.username}’ ({action?.member.name})님의{" "}
            {actionLabel} 처리를 진행하시겠어요?
          </p>
          <p className="field-help">
            {action?.kind === "status"
              ? action.value
                ? "계정의 로그인과 인증 기능 이용이 다시 허용됩니다."
                : "로그인이 차단되며, 기존 로그인 상태에서도 API 이용이 차단됩니다."
              : action?.value
                ? "상품·재고·주문·회원 정보를 관리할 수 있는 권한을 부여합니다."
                : "기존 로그인 상태에서도 관리자 API 접근 권한이 회수됩니다."}
          </p>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            className="secondary-button"
            disabled={actionBusy}
            onClick={() => setAction(null)}
          >
            취소
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={actionBusy}
            onClick={() => void applyAction()}
          >
            {actionBusy ? "처리 중…" : actionLabel}
          </button>
        </ModalFooter>
      </Modal>
    </>
  );
}
