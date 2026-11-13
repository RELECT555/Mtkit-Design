import { Button } from "@mtkit/ui";
import { clientLabels, installClients, type InstallClient } from "@mtkit-design/catalog";

export function ClientPicker({ client, onChange }: { client: InstallClient; onChange: (client: InstallClient) => void }) {
  return (
    <div className="switcher" role="group" aria-label="Агент">
      {installClients.map((id) => (
        <Button key={id} type="button" aria-pressed={id === client} onClick={() => onChange(id)}>{clientLabels[id]}</Button>
      ))}
    </div>
  );
}
