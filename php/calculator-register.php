<?php
/**
 * D-HUB Group: Maintenance Arrears Calculator, step 1.
 *
 * Saves only the contact details of people who open the calculator: their name (optional), a mobile
 * number or e-mail address (at least one), the optional marketing choice and the dates of their visits.
 * The figures entered into the calculator and the statements it produces are never sent here.
 *
 * Needs php/config.php on the server (copy config.sample.php and add the database details).
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

/*
 * Switch for the contact step. While this is false the endpoint saves nothing: it opens no database
 * connection and answers success, so a visitor still running an older copy of the script is not blocked.
 * Set it to true only after php/config.php is on the server and the database is ready, and keep it in step
 * with CONTACT_STEP_ON in help-desk/calculator.js.
 */
const DHUB_CONTACT_SAVING_ON = false;

function respond(bool $success, string $message, int $status = 200): void {
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Method not allowed.', 405);
}

// Contact saving is switched off: answer success without storing anything or touching the database.
if (!DHUB_CONTACT_SAVING_ON) {
    respond(true, 'Thank you. The calculator is now open.');
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    error_log('calculator-register: php/config.php is missing');
    respond(false, 'The calculator is not connected to our database yet. Please contact D-HUB Project Management Consultancy.', 503);
}
require $configFile;

$raw = file_get_contents('php://input');
$data = (!empty($raw) && str_starts_with(trim($raw), '{')) ? (json_decode($raw, true) ?? []) : $_POST;

// Honeypot: real visitors never fill the hidden field. Pretend success and store nothing.
if (!empty($data['website'])) {
    respond(true, 'Thank you. The calculator is now open.');
}

/** Reads one submitted field as text. Arrays and objects are ignored, so they cannot break the checks. */
function field(array $data, string $key): string {
    $value = $data[$key] ?? '';
    return is_scalar($value) ? (string)$value : '';
}

function clean_text(string $value): string {
    // Strip control characters, including line breaks, so nothing can inject extra fields.
    return trim(preg_replace('/[\x00-\x1F\x7F]/', ' ', $value) ?? '');
}

/** Returns null when empty, false when not a valid Indian mobile number, or the 10 digits. */
function normalise_mobile(string $value): string|false|null {
    if ($value === '') {
        return null;
    }
    if (!preg_match('/^[0-9+()\s-]+$/', $value)) {
        return false;
    }
    $digits = preg_replace('/\D/', '', $value);
    if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
        $digits = substr($digits, 2);
    } elseif (strlen($digits) === 11 && $digits[0] === '0') {
        $digits = substr($digits, 1);
    }
    return preg_match('/^[6-9][0-9]{9}$/', $digits) ? $digits : false;
}

$name = clean_text(field($data, 'name'));
if (mb_strlen($name) > 120) {
    respond(false, 'Please keep the name under 120 characters.', 422);
}
$name = $name === '' ? null : $name;

$mobile = normalise_mobile(clean_text(field($data, 'mobile')));
if ($mobile === false) {
    respond(false, 'Please enter a valid 10-digit mobile number, starting with 6, 7, 8 or 9.', 422);
}

$email = strtolower(clean_text(field($data, 'email')));
if ($email !== '' && (strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
    respond(false, 'Please enter a valid e-mail address.', 422);
}
$email = $email === '' ? null : $email;

if ($mobile === null && $email === null) {
    respond(false, 'Give a mobile number or an e-mail address, or both.', 422);
}

$marketing = filter_var($data['marketing'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

try {
    $pdo = new PDO(DHUB_DB_DSN, DHUB_DB_USER, DHUB_DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS calculator_contacts (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NULL,
            mobile CHAR(10) NULL,
            email VARCHAR(190) NULL,
            marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
            first_seen DATETIME NOT NULL,
            last_seen DATETIME NOT NULL,
            visits INT UNSIGNED NOT NULL DEFAULT 1,
            UNIQUE KEY uq_mobile (mobile),
            UNIQUE KEY uq_email (email)
        ) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci'
    );
    // Same person again: keep one row, count the visit and fill in any detail that was missing.
    $stmt = $pdo->prepare(
        'INSERT INTO calculator_contacts (name, mobile, email, marketing_consent, first_seen, last_seen, visits)
         VALUES (:name, :mobile, :email, :marketing, NOW(), NOW(), 1)
         ON DUPLICATE KEY UPDATE
            name = COALESCE(VALUES(name), name),
            mobile = COALESCE(mobile, VALUES(mobile)),
            email = COALESCE(email, VALUES(email)),
            marketing_consent = VALUES(marketing_consent),
            last_seen = NOW(),
            visits = visits + 1'
    );
    $stmt->execute([
        ':name' => $name,
        ':mobile' => $mobile,
        ':email' => $email,
        ':marketing' => $marketing,
    ]);
} catch (PDOException $e) {
    // Log the error code only, never the details that were submitted.
    error_log('calculator-register: database error code ' . $e->getCode());
    respond(false, 'Sorry, we could not save your details just now. Please try again.', 500);
}

respond(true, 'Thank you. The calculator is now open.');
