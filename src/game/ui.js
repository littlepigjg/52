import { ORE_PRICES, ORE_NAMES, UPGRADE_DEFS, TILE_SIZE, SURFACE_Y } from './constants.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.warningTimeout = null;
    this.setupShopButtons();
  }

  setupShopButtons() {
    document.getElementById('sellAllBtn').addEventListener('click', () => {
      const money = this.game.player.sellOres(ORE_PRICES);
      if (money > 0) {
        this.showWarning(`售出矿石获得 $${money}`, 1500, 'text-green-300');
      }
      this.updateShop();
    });

    document.getElementById('refuelBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 50) {
        this.game.player.gold -= 50;
        this.game.player.fuel = this.game.player.maxFuel;
        this.updateShop();
      }
    });

    document.getElementById('refillOxygenBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 30) {
        this.game.player.gold -= 30;
        this.game.player.oxygen = this.game.player.maxOxygen;
        this.updateShop();
      }
    });

    document.getElementById('coolBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 20) {
        this.game.player.gold -= 20;
        this.game.player.heat = 20;
        this.updateShop();
      }
    });

    document.getElementById('repairBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 40) {
        this.game.player.gold -= 40;
        this.game.player.health = this.game.player.maxHealth;
        this.updateShop();
      }
    });

    document.getElementById('closeShopBtn').addEventListener('click', () => {
      this.closeShop();
    });
  }

  updateHUD() {
    const p = this.game.player;

    this.setBar('fuel', p.fuel, p.maxFuel);
    this.setBar('oxygen', p.oxygen, p.maxOxygen);
    this.setBar('heat', p.heat, p.maxHeat);
    this.setBar('cargo', p.cargoUsed, p.maxCargo);
    this.setBar('health', p.health, p.maxHealth);

    document.getElementById('goldText').textContent = Math.floor(p.gold);
    document.getElementById('depthText').textContent = Math.max(0, p.tileY - SURFACE_Y);

    document.getElementById('oreGold').textContent = p.cargo.gold;
    document.getElementById('oreIron').textContent = p.cargo.iron;
    document.getElementById('oreDiamond').textContent = p.cargo.diamond;
    document.getElementById('oreCoal').textContent = p.cargo.coal;
    document.getElementById('oreEmerald').textContent = p.cargo.emerald;
    document.getElementById('oreRuby').textContent = p.cargo.ruby;

    this.checkWarnings();
  }

  setBar(name, value, max) {
    const bar = document.getElementById(name + 'Bar');
    const text = document.getElementById(name + 'Text');
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    bar.style.width = pct + '%';
    text.textContent = `${Math.floor(value)}/${Math.floor(max)}`;
  }

  checkWarnings() {
    const p = this.game.player;
    const warnings = [];

    if (p.fuel < p.maxFuel * 0.15) warnings.push('⚠️ 燃料不足！');
    if (p.oxygen < p.maxOxygen * 0.15) warnings.push('⚠️ 氧气不足！');
    if (p.heat > p.maxHeat * 0.8) warnings.push('⚠️ 温度过高！');
    if (p.health < p.maxHealth * 0.2) warnings.push('⚠️ 机身受损严重！');
    if (p.cargoUsed >= p.maxCargo) warnings.push('📦 货仓已满！');

    const msg = warnings.join('  ');
    if (msg && !this.warningTimeout) {
      this.showWarning(msg, 2000);
    }
  }

  showWarning(text, duration = 2000, colorClass = 'text-red-200') {
    const el = document.getElementById('warningMessage');
    const textEl = document.getElementById('warningText');
    textEl.textContent = text;
    textEl.className = `font-game text-lg ${colorClass}`;
    el.classList.remove('hidden');

    if (this.warningTimeout) clearTimeout(this.warningTimeout);
    this.warningTimeout = setTimeout(() => {
      el.classList.add('hidden');
      this.warningTimeout = null;
    }, duration);
  }

  openShop() {
    if (!this.game.player.isOnSurface()) {
      this.showWarning('需要返回地面才能打开商店！', 1500);
      return false;
    }
    this.updateShop();
    document.getElementById('shopMenu').classList.remove('hidden');
    document.getElementById('shopMenu').classList.add('flex');
    this.game.paused = true;
    return true;
  }

  closeShop() {
    document.getElementById('shopMenu').classList.add('hidden');
    document.getElementById('shopMenu').classList.remove('flex');
    this.game.paused = false;
  }

  isShopOpen() {
    return !document.getElementById('shopMenu').classList.contains('hidden');
  }

  updateShop() {
    const p = this.game.player;
    document.getElementById('shopGold').textContent = Math.floor(p.gold);

    const sellArea = document.getElementById('sellArea');
    sellArea.innerHTML = '';
    for (const [type, count] of Object.entries(p.cargo)) {
      if (count > 0) {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center text-gray-300';
        div.innerHTML = `
          <span>${this.getOreIcon(type)} ${ORE_NAMES[type]} x${count}</span>
          <span class="text-yellow-400">$${count * ORE_PRICES[type]}</span>
        `;
        sellArea.appendChild(div);
      }
    }
    if (sellArea.children.length === 0) {
      sellArea.innerHTML = '<div class="text-gray-500 text-center py-2">货仓为空</div>';
    }

    const upgradeArea = document.getElementById('upgradeArea');
    upgradeArea.innerHTML = '';
    for (const [key, def] of Object.entries(UPGRADE_DEFS)) {
      const level = p.upgrades[key];
      const cost = p.getUpgradeCost(key);
      const isMaxed = cost === null;
      const canAfford = !isMaxed && p.gold >= cost;

      const div = document.createElement('div');
      div.className = 'bg-black/30 rounded p-3 border border-yellow-900';
      div.innerHTML = `
        <div class="flex justify-between items-center mb-1">
          <span class="text-yellow-300 font-bold">${def.icon} ${def.name}</span>
          <span class="text-xs text-gray-400">Lv.${level}/${def.maxLevel}</span>
        </div>
        <div class="text-xs text-gray-400 mb-2">${def.description}</div>
        <button class="w-full py-1 px-2 rounded text-xs font-bold transition-all ${
          isMaxed ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
          canAfford ? 'bg-yellow-700 hover:bg-yellow-600 text-white border border-yellow-500' :
          'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
        }" ${isMaxed || !canAfford ? 'disabled' : `data-upgrade="${key}"`}>
          ${isMaxed ? '已满级' : `$${cost}`}
        </button>
      `;
      upgradeArea.appendChild(div);
    }

    upgradeArea.querySelectorAll('button[data-upgrade]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.upgrade;
        if (p.buyUpgrade(type)) {
          this.updateShop();
        }
      });
    });
  }

  getOreIcon(type) {
    const icons = {
      coal: '⬛',
      iron: '🔩',
      gold: '🪙',
      emerald: '💚',
      ruby: '❤️',
      diamond: '💎'
    };
    return icons[type] || '🪨';
  }

  showGameOver(stats) {
    const screen = document.getElementById('gameOverScreen');
    const statsEl = document.getElementById('gameOverStats');
    statsEl.innerHTML = `
      <div>💰 最终金币: ${Math.floor(stats.gold)}</div>
      <div>📍 最深深度: ${stats.maxDepth}m</div>
      <div>⚔️ 击杀敌人: ${stats.enemiesKilled || 0}</div>
      <div>🪨 挖掘方块: ${stats.blocksDug || 0}</div>
    `;
    screen.classList.remove('hidden');
    screen.classList.add('flex');
  }

  hideGameOver() {
    const screen = document.getElementById('gameOverScreen');
    screen.classList.add('hidden');
    screen.classList.remove('flex');
  }

  showHUD() {
    document.getElementById('hud').classList.remove('hidden');
  }

  hideHUD() {
    document.getElementById('hud').classList.add('hidden');
  }
}
