'use client';

import {
  ACTION_LABELS,
  CRUD_ACTIONS,
  MODULE_ACTIONS,
  MODULE_LABELS,
  MODULES,
  permissionKey,
  type CrudAction,
  type ModulePermission,
  type PermissionKey,
} from '@/lib/permissions';

type Props = {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  disabled?: boolean;
};

export function CrudPermissionsEditor({ value, onChange, disabled }: Props) {
  const set = new Set(value);

  function toggle(mod: ModulePermission, act: CrudAction) {
    if (disabled) return;
    const key = permissionKey(mod, act);
    onChange(set.has(key) ? value.filter((p) => p !== key) : [...value, key]);
  }

  function toggleModule(mod: ModulePermission, on: boolean) {
    if (disabled) return;
    const keys = MODULE_ACTIONS[mod].map((a) => permissionKey(mod, a));
    onChange(
      on
        ? ([...new Set([...value, ...keys])] as PermissionKey[])
        : value.filter((p) => !keys.includes(p as PermissionKey)),
    );
  }

  return (
    <div className="perms-crud-wrap">
      <table className="data-table perms-crud-table">
        <thead>
          <tr>
            <th>Module</th>
            {CRUD_ACTIONS.map((a) => (
              <th key={a} className="perms-crud-action-col">
                {ACTION_LABELS[a]}
              </th>
            ))}
            <th className="perms-crud-action-col">Tout</th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod) => {
            const actions = MODULE_ACTIONS[mod];
            const allOn = actions.every((a) => set.has(permissionKey(mod, a)));
            const someOn = actions.some((a) => set.has(permissionKey(mod, a)));
            return (
              <tr key={mod}>
                <td>{MODULE_LABELS[mod]}</td>
                {CRUD_ACTIONS.map((act) => {
                  if (!actions.includes(act)) {
                    return (
                      <td key={act} className="perms-crud-empty">
                        —
                      </td>
                    );
                  }
                  const key = permissionKey(mod, act);
                  return (
                    <td key={act} className="perms-crud-check">
                      <input
                        type="checkbox"
                        checked={set.has(key)}
                        disabled={disabled}
                        onChange={() => toggle(mod, act)}
                        aria-label={`${MODULE_LABELS[mod]} — ${ACTION_LABELS[act]}`}
                      />
                    </td>
                  );
                })}
                <td className="perms-crud-check">
                  <input
                    type="checkbox"
                    checked={allOn}
                    disabled={disabled}
                    ref={(el) => {
                      if (el) el.indeterminate = someOn && !allOn;
                    }}
                    onChange={() => toggleModule(mod, !allOn)}
                    aria-label={`${MODULE_LABELS[mod]} — tout`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
