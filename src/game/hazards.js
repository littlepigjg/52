import { TILE_SIZE, TILE_TYPES } from './constants.js';

export class PoisonGasCloud {
  constructor(x, y, tileX, tileY) {
    this.x = x;
    this.y = y;
    this.tileX = tileX;
    this.tileY = tileY;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = -0.1 - Math.random() * 0.1;
    this.size = TILE_SIZE * (0.8 + Math.random() * 0.4);
    this.life = 600 + Math.random() * 400;
    this.maxLife = 1000;
    this.damageTimer = 0;
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  update(dt, world) {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.005;
    if (this.vy > 0.2) this.vy = 0.2;

    const newTileX = Math.floor(this.x / TILE_SIZE);
    const newTileY = Math.floor(this.y / TILE_SIZE);
    if (world.isSolid(newTileX, newTileY)) {
      this.vx = -this.vx * 0.5;
      this.vy = -this.vy * 0.3;
      this.x += this.vx * 5;
      this.y += this.vy * 5;
    }
    this.tileX = newTileX;
    this.tileY = newTileY;

    if (Math.random() < 0.002) {
      this.vx += (Math.random() - 0.5) * 0.2;
    }

    this.life -= dt * 60;
    this.pulsePhase += dt * 2;
    return this.life > 0;
  }

  getDamageRadius() {
    return this.size * 0.6;
  }

  isAlive() {
    return this.life > 0;
  }
}

export class HazardManager {
  constructor() {
    this.poisonClouds = [];
    this.collapseWarnings = [];
  }

  spawnPoisonClouds(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * TILE_SIZE;
      const offsetY = (Math.random() - 0.5) * TILE_SIZE;
      this.poisonClouds.push(new PoisonGasCloud(
        x + offsetX,
        y + offsetY,
        Math.floor(x / TILE_SIZE),
        Math.floor(y / TILE_SIZE)
      ));
    }
  }

  addCollapseWarning(tileX, tileY) {
    this.collapseWarnings.push({
      tileX,
      tileY,
      timer: 60,
      phase: 0
    });
  }

  update(dt, world, player, onDamage) {
    for (let i = this.poisonClouds.length - 1; i >= 0; i--) {
      const cloud = this.poisonClouds[i];
      if (!cloud.update(dt, world)) {
        this.poisonClouds.splice(i, 1);
        continue;
      }

      const dx = player.x - cloud.x;
      const dy = player.y - cloud.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < cloud.getDamageRadius()) {
        cloud.damageTimer += dt;
        if (cloud.damageTimer >= 0.3) {
          cloud.damageTimer = 0;
          const intensity = 1 - dist / cloud.getDamageRadius();
          onDamage('poison', intensity * 4);
        }
      }
    }

    for (let i = this.collapseWarnings.length - 1; i >= 0; i--) {
      const w = this.collapseWarnings[i];
      w.timer -= dt * 60;
      w.phase += dt * 10;
      if (w.timer <= 0) {
        this.collapseWarnings.splice(i, 1);
      }
    }
  }

  getTotalPoisonDamage(dt = 0) {
    return this.poisonClouds.length > 0 ? 0.5 * dt : 0;
  }

  render(ctx, worldToScreen) {
    for (const cloud of this.poisonClouds) {
      const screen = worldToScreen(cloud.x, cloud.y);
      const alpha = Math.min(0.5, (cloud.life / cloud.maxLife) * 0.6);
      const pulse = 1 + Math.sin(cloud.pulsePhase) * 0.1;
      const size = cloud.size * pulse;

      const gradient = ctx.createRadialGradient(
        screen.x, screen.y, 0,
        screen.x, screen.y, size / 2
      );
      gradient.addColorStop(0, `rgba(124, 252, 0, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(144, 238, 144, ${alpha * 0.6})`);
      gradient.addColorStop(1, `rgba(50, 205, 50, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const w of this.collapseWarnings) {
      const screen = worldToScreen(w.tileX * TILE_SIZE, w.tileY * TILE_SIZE);
      const alpha = Math.min(1, w.timer / 30) * (0.5 + Math.sin(w.phase) * 0.5);

      ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(screen.x + 2, screen.y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

      ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠', screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2 + 6);
    }
  }

  clear() {
    this.poisonClouds = [];
    this.collapseWarnings = [];
  }
}
