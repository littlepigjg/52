import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, SURFACE_Y, TILE_TYPES, TILE_COLORS } from './constants.js';
import { World } from './world.js';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { Renderer } from './renderer.js';
import { UIManager } from './ui.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.ui = new UIManager(this);
    
    this.paused = false;
    this.running = false;
    this.lastTime = 0;
    
    this.stats = {
      blocksDug: 0,
      enemiesKilled: 0
    };

    this.input = {
      left: false,
      right: false,
      up: false,
      down: false,
      dig: false,
      shoot: false
    };

    this.bullets = [];
    this.particles = [];
    this.collapseTimer = 0;
    this.poisonTimer = 0;

    this.baseBuildingX = Math.floor(WORLD_WIDTH / 2) - 3;

    this.setupInput();
    this.init();
  }

  init() {
    const seed = Date.now();
    this.world = new World(seed);

    const startX = Math.floor(WORLD_WIDTH / 2);
    const startY = SURFACE_Y - 1;

    for (let dy = 0; dy < 5; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = startX + dx;
        const ty = SURFACE_Y + dy;
        if (this.world.inBounds(tx, ty)) {
          const idx = this.world.getIndex(tx, ty);
          this.world.tiles[idx] = TILE_TYPES.EMPTY;
          this.world.tileHealth[idx] = 0;
          this.world.dugTiles[idx] = 1;
        }
      }
    }

    this.player = new Player(startX, startY);
    this.enemies = new EnemyManager();
    this.bullets = [];
    this.particles = [];
    this.stats = { blocksDug: 0, enemiesKilled: 0 };
    this.poisonTimer = 0;
    this.collapseTimer = 0;
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      if (!this.running) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.input.left = true;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.input.right = true;
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.input.up = true;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.input.down = true;
          break;
        case ' ':
          this.input.dig = true;
          e.preventDefault();
          break;
        case 'x':
        case 'X':
          this.input.shoot = true;
          break;
        case 'Escape':
          if (this.ui.isShopOpen()) {
            this.ui.closeShop();
          } else {
            this.ui.openShop();
          }
          e.preventDefault();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.input.left = false;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.input.right = false;
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.input.up = false;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.input.down = false;
          break;
        case ' ':
          this.input.dig = false;
          break;
        case 'x':
        case 'X':
          this.input.shoot = false;
          break;
      }
    });
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.ui.showHUD();
    this.ui.hideGameOver();
    this.loop();
  }

  loop() {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (!this.paused) {
      this.update(dt);
    }

    this.renderer.render(
      dt,
      this.world,
      this.player,
      this.enemies.enemies,
      this.bullets,
      this.particles,
      this.baseBuildingX
    );

    this.ui.updateHUD();

    if (this.player.health <= 0) {
      this.gameOver();
      return;
    }

    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    this.player.update(dt, this.world, this.input);
    this.enemies.update(dt, this.player, this.world);
    this.handleDigging(dt);
    this.handleShooting(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.checkHazards(dt);
    this.checkCollapses(dt);
    this.checkEnemyKills();
  }

  handleDigging(dt) {
    if (!this.input.dig) return;

    const target = this.player.getDigTarget();
    const result = this.world.digTile(target.x, target.y, this.player.drillPower);

    if (result.success) {
      if (result.damaged) {
        this.spawnParticles(
          target.x * TILE_SIZE + TILE_SIZE / 2,
          target.y * TILE_SIZE + TILE_SIZE / 2,
          this.getDustColor(this.world.getTile(target.x, target.y)),
          2,
          1
        );
      }

      if (result.broke) {
        this.stats.blocksDug++;
        this.renderer.shake(1, 0.1);

        if (result.ore) {
          if (this.player.addOre(result.ore)) {
            this.spawnParticles(
              target.x * TILE_SIZE + TILE_SIZE / 2,
              target.y * TILE_SIZE + TILE_SIZE / 2,
              this.getOreColor(result.ore),
              8,
              2
            );
          }
        } else {
          this.spawnParticles(
            target.x * TILE_SIZE + TILE_SIZE / 2,
            target.y * TILE_SIZE + TILE_SIZE / 2,
            this.getDustColor(this.world.getTile(target.x, target.y)),
            5,
              2
          );
        }

        if (result.hazard === 'poison') {
          this.poisonTimer = 3;
          this.ui.showWarning('☠️ 毒气泄漏！持续受到伤害', 2000);
        }

        if (result.hazard === 'instability') {
          this.triggerCollapse(target.x, target.y);
        }

        this.player.fuel -= this.player.fuelConsumption * 0.5 * dt * 60;
        this.player.addHeat(this.player.heatGeneration * 0.3 * dt * 60);
      }
    } else if (result.tooHard) {
      this.ui.showWarning('⛏️ 钻头等级不够，无法挖掘此方块！', 1000);
      this.input.dig = false;
    }
  }

  handleShooting(dt) {
    if (!this.input.shoot) return;

    const now = performance.now();
    let dirX = 0, dirY = 0;
    switch (this.player.facing) {
      case 'up': dirY = -1; break;
      case 'down': dirY = 1; break;
      case 'left': dirX = -1; break;
      case 'right': dirX = 1; break;
    }

    const bullet = this.player.shoot(now, dirX, dirY);
    if (bullet) {
      this.bullets.push(bullet);
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life -= dt * 60;

      const tileX = Math.floor(b.x / TILE_SIZE);
      const tileY = Math.floor(b.y / TILE_SIZE);
      if (this.world.isSolid(tileX, tileY)) {
        this.spawnParticles(b.x, b.y, '#FFD700', 3, 1);
        this.bullets.splice(i, 1);
        continue;
      }

      if (this.enemies.checkBulletCollision(b)) {
        this.spawnParticles(b.x, b.y, '#FF4444', 5, 2);
        this.renderer.shake(0.5, 0.1);
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.life <= 0) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= dt * 60;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  spawnParticles(x, y, color, count, size) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        color: color,
        size: size + Math.random() * 2,
        life: 20 + Math.random() * 20,
        maxLife: 40
      });
    }
  }

  getDustColor(tile) {
    const colors = TILE_COLORS[tile];
    if (colors && colors.length > 0) return colors[0];
    return '#8B4513';
  }

  getOreColor(oreType) {
    const colorMap = {
      coal: '#2F2F2F',
      iron: '#B87333',
      gold: '#FFD700',
      emerald: '#50C878',
      ruby: '#E0115F',
      diamond: '#00CED1'
    };
    return colorMap[oreType] || '#FFFFFF';
  }

  checkHazards(dt) {
    const px = this.player.tileX;
    const py = this.player.tileY;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        const tile = this.world.getTile(tx, ty);
        if (tile === TILE_TYPES.LAVA) {
          this.player.addHeat(2 * dt * 60);
        }
      }
    }

    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      this.player.takeDamage(3 * dt);
      this.spawnParticles(
        this.player.x,
        this.player.y,
        '#7CFC00',
        2,
        2
      );
    }
  }

  checkCollapses(dt) {
    this.collapseTimer += dt;
    if (this.collapseTimer < 0.5) return;
    this.collapseTimer = 0;

    const collapses = this.world.checkCollapse(this.player.tileX, this.player.tileY);
    for (const c of collapses) {
      const tile = this.world.getTile(c.x, c.y);
      if (tile !== TILE_TYPES.EMPTY && tile !== TILE_TYPES.CAVE) {
        this.triggerCollapse(c.x, c.y);
      }
    }
  }

  triggerCollapse(x, y) {
    if (!this.world.inBounds(x, y)) return;
    const tile = this.world.getTile(x, y);
    if (tile === TILE_TYPES.BEDROCK || tile === TILE_TYPES.EMPTY || tile === TILE_TYPES.CAVE) return;

    this.ui.showWarning('⚠️ 塌方！', 800);
    this.renderer.shake(3, 0.5);

    const dx = (x + 0.5) * TILE_SIZE - this.player.x;
    const dy = (y + 0.5) * TILE_SIZE - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < TILE_SIZE * 1.5) {
      this.player.takeDamage(15);
    }

    this.enemies.damageEnemyAt(
      (x + 0.5) * TILE_SIZE,
      (y + 0.5) * TILE_SIZE,
      TILE_SIZE * 1.5,
      50
    );

    const idx = this.world.getIndex(x, y);
    this.world.tiles[idx] = TILE_TYPES.EMPTY;
    this.world.tileHealth[idx] = 0;
    this.world.dugTiles[idx] = 1;

    this.spawnParticles(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2,
      this.getDustColor(tile),
      15,
      3
    );
  }

  checkEnemyKills() {
    const before = this.enemies.enemies.length;
    this.enemies.enemies = this.enemies.enemies.filter(e => e.health > 0);
    const killed = before - this.enemies.enemies.length;
    this.stats.enemiesKilled += killed;
  }

  gameOver() {
    this.running = false;
    this.ui.hideHUD();
    this.ui.showGameOver({
      gold: this.player.gold,
      maxDepth: this.player.maxDepth,
      enemiesKilled: this.stats.enemiesKilled,
      blocksDug: this.stats.blocksDug
    });
  }

  restart() {
    this.init();
    this.ui.hideGameOver();
    this.start();
  }
}
