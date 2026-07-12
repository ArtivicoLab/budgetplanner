// Spender / earner picker (competitor-parity #21). One-tap chips for the
// household members, plus a free-text input so a one-off name still works.
import { Chip, ChipRow } from "./Chip";
import { useSettings } from "../stores/useSettings";
import { memberOptions } from "../lib/household";

export function SpenderField({
  value, onChange, id = "spender", label = "Spender / earner", placeholder = "e.g. Me",
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
}) {
  const { householdMembers } = useSettings();
  const members = memberOptions(householdMembers);
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <ChipRow>
        {members.map((m) => (
          <Chip key={m} active={value.trim().toLowerCase() === m.toLowerCase()} onClick={() => onChange(value.trim().toLowerCase() === m.toLowerCase() ? "" : m)}>
            {m}
          </Chip>
        ))}
      </ChipRow>
      <input
        id={id}
        className="input mt-8"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list="household-members"
      />
      <datalist id="household-members">
        {members.map((m) => <option key={m} value={m} />)}
      </datalist>
    </div>
  );
}
