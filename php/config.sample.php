<?php
/**
 * Database settings for the Maintenance Arrears Calculator, which saves contact details only.
 *
 * To set this up on Hostinger:
 *   1. In hPanel, open Databases > MySQL Databases, and create a database and a user.
 *      Note the database name, the user name and the password.
 *   2. Copy this file to php/config.php in the same folder, and replace the three values below.
 *   3. Never commit php/config.php to Git or share it: it holds the database password.
 *
 * The contacts table is created automatically the first time someone opens the calculator.
 */

const DHUB_DB_DSN  = 'mysql:host=localhost;dbname=YOUR_DATABASE_NAME;charset=utf8mb4';
const DHUB_DB_USER = 'YOUR_DATABASE_USER';
const DHUB_DB_PASS = 'YOUR_DATABASE_PASSWORD';
