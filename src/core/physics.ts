import { ARENA_MAX_Y, ARENA_MIN_Y, Z_GRAVITY } from './constants';
import type { Obstacle } from './types';

export interface TopDownBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number
): boolean {
  const r = ar + br;
  return distSq(ax, ay, bx, by) <= r * r;
}

export function stepTopDownPhysics(
  body: TopDownBody,
  dt: number,
  obstacles: Obstacle[],
  minX: number,
  maxX: number
): { landed: boolean; impactVz: number } {
  const wasAirborne = body.z > 0;
  const prevVz = body.vz;

  // Move on X/Y ground plane
  body.x += body.vx * dt;
  body.y += body.vy * dt;

  // Clamp to active horizontal & vertical playable bounds
  if (body.x - body.radius < minX) {
    body.x = minX + body.radius;
    if (body.vx < 0) body.vx = 0;
  } else if (body.x + body.radius > maxX) {
    body.x = maxX - body.radius;
    if (body.vx > 0) body.vx = 0;
  }

  if (body.y - body.radius < ARENA_MIN_Y) {
    body.y = ARENA_MIN_Y + body.radius;
    if (body.vy < 0) body.vy = 0;
  } else if (body.y + body.radius > ARENA_MAX_Y) {
    body.y = ARENA_MAX_Y - body.radius;
    if (body.vy > 0) body.vy = 0;
  }

  // Push out of solid top-down obstacles (circle vs AABB)
  for (const obs of obstacles) {
    const closestX = Math.max(obs.x, Math.min(body.x, obs.x + obs.w));
    const closestY = Math.max(obs.y, Math.min(body.y, obs.y + obs.h));
    const dx = body.x - closestX;
    const dy = body.y - closestY;
    const d2 = dx * dx + dy * dy;

    if (d2 < body.radius * body.radius) {
      const d = Math.sqrt(d2);
      if (d > 0.0001) {
        const push = body.radius - d;
        body.x += (dx / d) * push;
        body.y += (dy / d) * push;
      } else {
        body.y = obs.y + obs.h + body.radius;
      }
    }
  }

  // Z-axis hop/jump physics
  if (body.z > 0 || body.vz > 0) {
    body.vz -= Z_GRAVITY * dt;
    body.z += body.vz * dt;
    if (body.z <= 0) {
      body.z = 0;
      body.vz = 0;
    }
  }

  return {
    landed: wasAirborne && body.z === 0,
    impactVz: Math.abs(prevVz),
  };
}
