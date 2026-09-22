<?php
/**
 * D-HUB Group contact form handler.
 *
 * Upload this file to your PHP-capable hosting (NOT GitHub Pages, which
 * cannot execute PHP). It receives the Contact Us form submission, validates
 * and sanitises the input, and sends it on to the office inbox via mail().
 *
 * Update ALLOWED_ORIGIN below to the exact origin the form is served from
 * (e.g. "https://dhubgroup.in"), and RECIPIENT_EMAIL if it ever changes.
 */

const ALLOWED_ORIGIN = 'https://dhubgroup.in';
const RECIPIENT_EMAIL = 'admin@dhubgroup.in';

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === ALLOWED_ORIGIN) {
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

function respond(bool $success, string $message, int $status = 200): void {
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Method not allowed.', 405);
}

$raw = file_get_contents('php://input');
$data = [];
if (!empty($raw) && str_starts_with(trim($raw), '{')) {
    $data = json_decode($raw, true) ?? [];
} else {
    $data = $_POST;
}

// Honeypot: a hidden field real visitors never fill in. If it has a value,
// silently pretend success so bots don't learn to avoid it.
if (!empty($data['website'])) {
    respond(true, 'Thank you. Your enquiry has been sent.');
}

function clean(string $value): string {
    // Strip control characters (incl. CR/LF) to block e-mail header injection.
    $value = preg_replace('/[\r\n\x00-\x1F\x7F]/', ' ', $value);
    return trim($value);
}

$name    = clean((string)($data['name'] ?? ''));
$email   = clean((string)($data['email'] ?? ''));
$phone   = clean((string)($data['phone'] ?? ''));
$service = clean((string)($data['service'] ?? ''));
$society = clean((string)($data['society'] ?? ''));
$message = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', (string)($data['message'] ?? '')));

if ($name === '' || $email === '' || $message === '') {
    respond(false, 'Please complete all required fields.', 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Please provide a valid e-mail address.', 422);
}

if (mb_strlen($name) > 200 || mb_strlen($message) > 5000) {
    respond(false, 'Submission is too long.', 422);
}

$subject = 'Enquiry from D-HUB Group website — ' . $name;

$bodyLines = [
    'A new enquiry has been submitted via the D-HUB Group website contact form.',
    '',
    'Name: ' . $name,
    'E-mail: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
    'Service of interest: ' . ($service !== '' ? $service : 'Not specified'),
    'Society / Organisation: ' . ($society !== '' ? $society : 'Not provided'),
    '',
    'Message:',
    $message,
];
$body = implode("\n", $bodyLines);

$fromAddress = 'no-reply@dhubgroup.in';
$headers = [
    'From: D-HUB Group Website <' . $fromAddress . '>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
];

$sent = mail(RECIPIENT_EMAIL, $subject, $body, implode("\r\n", $headers));

if ($sent) {
    respond(true, 'Thank you. Your enquiry has been sent — we will be in touch shortly.');
}

respond(false, 'Sorry, something went wrong while sending your enquiry. Please try again or contact us by phone.', 500);
