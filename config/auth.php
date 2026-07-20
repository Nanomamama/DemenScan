<?php
declare(strict_types=1);

require_once __DIR__ . '/database.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function h(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function current_admin(): ?array
{
    if (empty($_SESSION['admin_id'])) {
        return null;
    }

    $stmt = db()->prepare('SELECT id, username, display_name, role FROM admins WHERE id = ? AND is_active = 1');
    $stmt->execute([(int) $_SESSION['admin_id']]);
    $admin = $stmt->fetch();

    if (!$admin) {
        $_SESSION = [];
        session_destroy();
        return null;
    }

    return $admin;
}

function require_admin(): array
{
    $admin = current_admin();
    if ($admin) {
        return $admin;
    }

    header('Location: login.php');
    exit;
}

function login_admin(string $username, string $password): bool
{
    $stmt = db()->prepare('SELECT * FROM admins WHERE username = ? AND is_active = 1 LIMIT 1');
    $stmt->execute([$username]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        usleep(250000);
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];

    $update = db()->prepare('UPDATE admins SET last_login_at = NOW() WHERE id = ?');
    $update->execute([(int) $admin['id']]);

    return true;
}

function admin_username_exists(string $username, int $exceptAdminId): bool
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM admins WHERE username = ? AND id <> ?');
    $stmt->execute([$username, $exceptAdminId]);
    return (int) $stmt->fetchColumn() > 0;
}

function update_admin_profile(int $adminId, string $username, string $displayName): void
{
    $stmt = db()->prepare('UPDATE admins SET username = ?, display_name = ? WHERE id = ? AND is_active = 1');
    $stmt->execute([$username, $displayName, $adminId]);
}

function change_admin_password(int $adminId, string $currentPassword, string $newPassword): bool
{
    $stmt = db()->prepare('SELECT password_hash FROM admins WHERE id = ? AND is_active = 1');
    $stmt->execute([$adminId]);
    $hash = (string) $stmt->fetchColumn();

    if ($hash === '' || !password_verify($currentPassword, $hash)) {
        usleep(250000);
        return false;
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $update = db()->prepare('UPDATE admins SET password_hash = ? WHERE id = ? AND is_active = 1');
    $update->execute([$newHash, $adminId]);

    return true;
}

function logout_admin(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function risk_label(string $risk): string
{
    return match ($risk) {
        'low' => 'ความเสี่ยงต่ำ',
        'moderate' => 'ความเสี่ยงปานกลาง',
        'high' => 'ความเสี่ยงสูง',
        default => $risk,
    };
}
