import { Button } from "@mtkit/ui";
import { useEffect, useRef, useState } from "react";

export function Command({ value }: { value: string }) {
  const [status, setStatus] = useState("");
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeout.current), []);

  async function copy() {
    clearTimeout(timeout.current);
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Скопировано");
    } catch {
      setStatus("Выделите текст и скопируйте вручную");
    }
    timeout.current = setTimeout(() => setStatus(""), 3500);
  }

  return (
    <div className="command">
      <code>{value}</code>
      <div className="copy-action">
        <Button type="button" onClick={copy}>Копировать</Button>
        <span role="status">{status}</span>
      </div>
    </div>
  );
}
