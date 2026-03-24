// src/lib/auth.js
import sql from '$lib/db';
import crypto from 'crypto';
import { hasPermission, canView, canDataEntry, canManage, AREAS, LEVELS } from '$lib/permissions';
export { hasPermission, canView, canDataEntry, canManage, AREAS, LEVELS };

// ---- Session Config ----
const SESSION_DURATION_HOURS = 24 * 7; // 7 days
export const SESSION_COOKIE_NAME = 'session_id';

/**
 * Check if user has at least viewer access to ANY area
 * @param {any} user
 * @returns {boolean}
 */
export function hasAnyAccess(user) {
  if (!user) return false;
  if (user.is_super_admin) return true;
  const AREAS = ['hsi', 'gft', 'csz', 'corp'];
  return AREAS.some((area) => {
    const level = user[`${area}_role`] || 'none';
    return level !== 'none';
  });
}

/**
 * Get all areas a user can access at a given level
 * @param {any} user
 * @param {string} requiredLevel
 * @returns {string[]}
 */
export function getAccessibleAreas(user, requiredLevel = 'viewer') {
  if (!user) return [];
  if (user.is_super_admin) return [...AREAS];
  return AREAS.filter((area) => hasPermission(user, area, requiredLevel));
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function verifyPassword(email, password) {
  const [user] = await sql`
    SELECT user_id, email, first_name, last_name, display_name,
           is_active, is_super_admin,
           hsi_role, gft_role, csz_role, corp_role,
           password_hash
    FROM app_users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(${email}))
  `;
  if (!user || !user.is_active) return null;

  const [match] = await sql`
    SELECT (password_hash = crypt(${password}, password_hash)) AS valid
    FROM app_users WHERE user_id = ${user.user_id}
  `;
  if (!match?.valid) return null;

  const { password_hash, ...safeUser } = user;
  return safeUser;
}

/**
 * @param {any} userId
 * @param {string|null} ipAddress
 * @param {string|null} userAgent
 */
export async function createSession(userId, ipAddress = null, userAgent = null) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  await sql`
    INSERT INTO app_sessions (session_id, user_id, expires_at, ip_address, user_agent)
    VALUES (${sessionId}, ${userId}, ${expiresAt}, ${ipAddress}, ${userAgent})
  `;
  await sql`
    UPDATE app_users
    SET last_login_at = CURRENT_TIMESTAMP, login_count = login_count + 1
    WHERE user_id = ${userId}
  `;
  return { sessionId, expiresAt };
}

/** @param {string} sessionId */
export async function validateSession(sessionId) {
  if (!sessionId) return null;
  const [row] = await sql`
    SELECT
      s.session_id, s.expires_at,
      u.user_id, u.email, u.first_name, u.last_name, u.display_name,
      u.is_active, u.is_super_admin,
      u.hsi_role, u.gft_role, u.csz_role, u.corp_role
    FROM app_sessions s
    JOIN app_users u ON u.user_id = s.user_id
    WHERE s.session_id = ${sessionId}
      AND s.expires_at > CURRENT_TIMESTAMP
      AND u.is_active = true
  `;
  return row || null;
}

/** @param {string} sessionId */
export async function destroySession(sessionId) {
  if (!sessionId) return;
  await sql`DELETE FROM app_sessions WHERE session_id = ${sessionId}`;
}

export async function cleanupExpiredSessions() {
  await sql`DELETE FROM app_sessions WHERE expires_at < CURRENT_TIMESTAMP`;
}

/**
 * @param {any} userId
 * @param {string} newPassword
 */
export async function changePassword(userId, newPassword) {
  await sql`
    UPDATE app_users
    SET password_hash = crypt(${newPassword}, gen_salt('bf', 10)),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
  `;
}

/** @param {any} params */
export async function createUser({ email, password, firstName, lastName, displayName, isSuperAdmin, hsiRole, gftRole, cszRole, corpRole, createdBy }) {
  const [user] = await sql`
    INSERT INTO app_users (
      email, password_hash, first_name, last_name, display_name,
      is_super_admin, hsi_role, gft_role, csz_role, corp_role, created_by
    ) VALUES (
      ${email.trim().toLowerCase()},
      crypt(${password}, gen_salt('bf', 10)),
      ${firstName.trim()}, ${lastName.trim()},
      ${(displayName || `${firstName} ${lastName}`).trim()},
      ${isSuperAdmin || false},
      ${hsiRole || 'none'}, ${gftRole || 'none'},
      ${cszRole || 'none'}, ${corpRole || 'none'},
      ${createdBy || null}
    )
    RETURNING user_id, email, first_name, last_name, display_name
  `;
  return user;
}

/** @param {any} params */
export async function auditLog({ userId, userEmail, action, tableName, recordId, details, ipAddress }) {
  try {
    await sql`
      INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, details, ip_address)
      VALUES (
        ${userId || null}, ${userEmail || null}, ${action},
        ${tableName || null}, ${recordId?.toString() || null},
        ${details ? JSON.stringify(details) : null},
        ${ipAddress || null}
      )
    `;
  } catch (error) {
    console.error('Audit log error:', error);
  }
}