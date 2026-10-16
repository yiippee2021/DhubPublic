<?php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$pages = [
    'faq' => 100,
    'gr' => 1000,
];
$page = $_GET['page'] ?? 'faq';
if (!isset($pages[$page])) {
    $page = 'faq';
}
$floor = $pages[$page];

$file = __DIR__ . '/data/' . $page . '-views.txt';
$dir = dirname($file);
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$fp = fopen($file, 'c+');
if ($fp === false) {
    echo json_encode(['views' => $floor]);
    exit;
}
flock($fp, LOCK_EX);
$raw = stream_get_contents($fp);
$count = (int) trim((string) $raw);
if ($count < $floor) {
    $count = $floor;
}
$shown = $count;
ftruncate($fp, 0);
rewind($fp);
fwrite($fp, (string) ($count + 1));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['views' => $shown]);
