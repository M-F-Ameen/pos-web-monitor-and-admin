import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { IconSearch, IconFilter } from "../../ui/Icons";
import type { UserRole } from "../../../app/access";
import "./TopBar.css";

export interface TopBarUser {
  name: string;
  id: string;
  avatar?: string;
}

export interface TopBarProps {
  /** User info block on the left of the header (matches reference image) */
  user?: TopBarUser;
  collapsed?: boolean;
  role?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onFilterClick?: () => void;
}

/**
 * Top bar: centered search, filter button on right (matches image).
 * User profile lives in left sidebar.
 */
export function TopBar({
  user,
  collapsed = false,
  role,
  searchPlaceholder = "\u0627\u0628\u062d\u062b \u0628\u0627\u0644\u0627\u0633\u0645\u060c \u0627\u0644\u062a\u0635\u0646\u064a\u0641 \u0623\u0648 \u0631\u0645\u0632 \u0627\u0644\u0645\u0646\u062a\u062c",
  searchValue = "",
  onSearchChange,
  onFilterClick,
}: TopBarProps) {
  const topbarClassName = collapsed ? "pos-topbar pos-topbar--collapsed" : "pos-topbar";

  return (
    <header className={topbarClassName} role="banner" aria-hidden={collapsed}>
      {user && (
        <div
          className="pos-topbar__profile"
          aria-label="\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645"
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt=""
              className="pos-topbar__avatar"
              width={48}
              height={48}
            />
          ) : (
            <div className="pos-topbar__avatar-placeholder" aria-hidden />
          )}
          <div className="pos-topbar__user-text">
            <span className="pos-topbar__user-name">{user.name}</span>
            <span className="pos-topbar__user-id">{user.id}</span>
          </div>
        </div>
      )}
      <div className="pos-topbar__search">
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          icon={<IconSearch />}
          fullWidth
          size="md"
          className="pos-topbar__search-input"
          aria-label="\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a"
          disabled={collapsed}
        />
      </div>
      <div className="pos-topbar__actions">
        {role && (
          <div
            className="pos-topbar__role"
            aria-label="\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062d\u0627\u0644\u064a"
          >
            <span className="pos-topbar__role-badge">
              {role === "admin" ? "\u0645\u062f\u064a\u0631" : "\u0645\u0648\u0638\u0641"}
            </span>
          </div>
        )}
        <Button
          variant="primary"
          className="pos-topbar__filter"
          icon={<IconFilter />}
          onClick={onFilterClick}
          disabled={collapsed}
        >
          {"\u0641\u0644\u062a\u0631"}
        </Button>
      </div>
    </header>
  );
}
