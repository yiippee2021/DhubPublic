<?php
/**
 * D-HUB Group — Society Help Desk handler.
 *
 * Upload this file to your PHP-capable hosting alongside send-mail.php
 * (NOT GitHub Pages, which cannot execute PHP). Receives the Help Desk
 * form (help-desk.html), which is a distinct, low-key enquiry channel for
 * Society process questions — separate from the general Contact form.
 *
 * The optional photo of a notice/letter is attached directly to the e-mail
 * (never written to disk on the server), so there is nothing to clean up
 * and no web-accessible upload folder to secure.
 */

const ALLOWED_ORIGIN = 'https://dhubgroup.in';
const RECIPIENT_EMAIL = 'admin@dhubgroup.in';
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_PHOTO_TYPES = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];

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

// This form always submits as multipart/form-data (to allow the optional
// photo), so read from $_POST / $_FILES rather than a JSON body.
$data = $_POST;

// Honeypot: a hidden field real visitors never fill in.
if (!empty($data['website'])) {
    respond(true, 'Thank you. Your question has been sent to the desk.');
}

function clean(string $value): string {
    // Strip control characters (incl. CR/LF) to block e-mail header injection.
    $value = preg_replace('/[\r\n\x00-\x1F\x7F]/', ' ', $value);
    return trim($value);
}

$society  = clean((string)($data['society'] ?? ''));
$location = clean((string)($data['location'] ?? ''));
$role     = clean((string)($data['role'] ?? ''));
$topic    = clean((string)($data['topic'] ?? ''));
$prefer   = clean((string)($data['prefer'] ?? ''));
$mobile   = clean((string)($data['mobile'] ?? ''));
$email    = clean((string)($data['email'] ?? ''));
$question = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', (string)($data['question'] ?? '')));

if ($society === '' || $location === '' || $question === '' || $mobile === '') {
    respond(false, 'Please complete Society name, Location, your Question and Mobile number.', 422);
}

$mobileDigits = preg_replace('/\D/', '', $mobile);
if (strlen($mobileDigits) !== 10) {
    respond(false, 'Please provide a valid 10-digit mobile number.', 422);
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Please provide a valid e-mail address, or leave it blank.', 422);
}

if (mb_strlen($society) > 200 || mb_strlen($question) > 4000) {
    respond(false, 'Submission is too long.', 422);
}

// --- Optional photo of a notice/letter -------------------------------------
$photoAttachment = null; // ['data' => raw bytes, 'ext' => 'jpg', 'mime' => 'image/jpeg']
if (!empty($_FILES['photo']) && $_FILES['photo']['error'] !== UPLOAD_ERR_NO_FILE) {
    $file = $_FILES['photo'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        respond(false, 'The photo could not be uploaded. Please try again without it, or with a smaller file.', 422);
    }
    if ($file['size'] > MAX_PHOTO_BYTES) {
        respond(false, 'The photo is too large (max 4 MB). Please try a smaller image.', 422);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detectedType = $finfo->file($file['tmp_name']);

    if (!isset(ALLOWED_PHOTO_TYPES[$detectedType])) {
        respond(false, 'Please attach a JPG, PNG or WEBP photo.', 422);
    }

    $bytes = file_get_contents($file['tmp_name']);
    if ($bytes === false) {
        respond(false, 'The photo could not be read. Please try again.', 422);
    }

    $photoAttachment = [
        'data' => $bytes,
        'ext'  => ALLOWED_PHOTO_TYPES[$detectedType],
        'mime' => $detectedType,
    ];
}

// --- Compose the e-mail ------------------------------------------------------
$subject = '[Society Help Desk] ' . $society . ($topic !== '' ? ' — ' . $topic : '');

$bodyLines = [
    'A new question has been submitted via the D-HUB Group Society Help Desk.',
    'This channel is process-question support, not legal advice.',
    '',
    'Society name: ' . $society,
    'Location: ' . $location,
    'Role: ' . ($role !== '' ? $role : 'Not specified'),
    'Topic: ' . ($topic !== '' ? $topic : 'Not specified'),
    'Preferred reply mode: ' . ($prefer !== '' ? $prefer : 'Not specified'),
    'Mobile: ' . $mobileDigits,
    'E-mail: ' . ($email !== '' ? $email : 'Not provided'),
    'Photo attached: ' . ($photoAttachment !== null ? 'Yes' : 'No'),
    '',
    'Question:',
    $question,
];
$textBody = implode("\n", $bodyLines);

$fromAddress = 'no-reply@dhubgroup.in';
$replyTo = $email !== '' ? $email : $fromAddress;

if ($photoAttachment === null) {
    $headers = [
        'From: D-HUB Society Help Desk <' . $fromAddress . '>',
        'Reply-To: ' . $replyTo,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    $sent = mail(RECIPIENT_EMAIL, $subject, $textBody, implode("\r\n", $headers));
} else {
    // Build a multipart/mixed message by hand: a text part plus the photo
    // as a base64 attachment. Nothing is ever written to disk on the server.
    $boundary = 'dhub-helpdesk-' . bin2hex(random_bytes(12));

    $headers = [
        'From: D-HUB Society Help Desk <' . $fromAddress . '>',
        'Reply-To: ' . $replyTo,
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
    ];

    $filename = 'notice-photo.' . $photoAttachment['ext'];
    $encoded = chunk_split(base64_encode($photoAttachment['data']));

    $mimeBody = "--{$boundary}\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: 8bit\r\n\r\n"
        . $textBody . "\r\n\r\n"
        . "--{$boundary}\r\n"
        . "Content-Type: {$photoAttachment['mime']}; name=\"{$filename}\"\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n"
        . $encoded . "\r\n"
        . "--{$boundary}--";

    $sent = mail(RECIPIENT_EMAIL, $subject, $mimeBody, implode("\r\n", $headers));
}

if ($sent) {
    respond(true, 'Thank you. Your question has been sent to the desk — we will reply as you preferred.');
}

respond(false, 'Sorry, something went wrong while sending your question. Please try again or contact us by phone.', 500);
