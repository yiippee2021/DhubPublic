<?php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$file = __DIR__ . '/data/faq-views.txt';
$dir = dirname($file);
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$fp = fopen($file, 'c+');
if ($fp === false) {
    echo json_encode(['views' => 100]);
    exit;
}
flock($fp, LOCK_EX);
$raw = stream_get_contents($fp);
$count = (int) trim((string) $raw);
if ($count < 100) {
    $count = 100;
}
$shown = $count;
ftruncate($fp, 0);
rewind($fp);
fwrite($fp, (string) ($count + 1));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['views' => $shown]);
