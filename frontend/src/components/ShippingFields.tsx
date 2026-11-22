import type { ShippingInfo } from "../domain";

export default function ShippingFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ShippingInfo;
  onChange: (field: keyof ShippingInfo, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset
      className="form-grid product-form shipping-fields"
      disabled={disabled}
    >
      <label>
        받는 분
        <input
          name="recipient"
          required
          maxLength={50}
          pattern=".*\S.*"
          autoComplete="shipping name"
          value={value.recipient}
          onChange={(e) => onChange("recipient", e.target.value)}
        />
      </label>
      <label>
        연락처
        <input
          name="phone"
          type="tel"
          required
          maxLength={20}
          autoComplete="shipping tel"
          placeholder="010-0000-0000"
          value={value.phone}
          onChange={(e) => onChange("phone", e.target.value)}
        />
      </label>
      <label>
        우편번호
        <input
          name="postalCode"
          required
          inputMode="numeric"
          pattern="[0-9]{5}"
          maxLength={5}
          autoComplete="shipping postal-code"
          placeholder="숫자 5자리"
          value={value.postalCode}
          onChange={(e) => onChange("postalCode", e.target.value)}
        />
      </label>
      <label className="form-full">
        기본 주소
        <input
          name="address"
          required
          maxLength={200}
          pattern=".*\S.*"
          autoComplete="shipping address-line1"
          placeholder="도로명 또는 지번 주소"
          value={value.address}
          onChange={(e) => onChange("address", e.target.value)}
        />
      </label>
      <label className="form-full">
        상세 주소 (선택)
        <input
          name="addressDetail"
          maxLength={100}
          autoComplete="shipping address-line2"
          placeholder="동·호수 등"
          value={value.addressDetail}
          onChange={(e) => onChange("addressDetail", e.target.value)}
        />
      </label>
      <label className="form-full">
        배송 요청사항 (선택)
        <textarea
          name="memo"
          maxLength={200}
          rows={3}
          placeholder="배송 시 요청사항을 남겨 주세요."
          value={value.memo}
          onChange={(e) => onChange("memo", e.target.value)}
        />
      </label>
    </fieldset>
  );
}
