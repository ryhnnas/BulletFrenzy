$(document).ready(function() {

        // --- VARIABEL BARU & DETEKSI MOBILE ---
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Game Variables
        let gameState = {
            score: 0,
            health: 100,
            ammo: 30,
            wave: 1,
            combo: 0,
            isGameOver: false,
            achievements: new Set()
        };

        // Enhanced Game Settings
        const SETTINGS = {
            SHOOT_KNOCKBACK: 8,
            SHOOT_KNOCKBACKRESET: 0.3,
            PLAYER_SPEED: 1.2,
            BULLET_SPEED: 25,
            ENEMY_SPAWN_RATE: 0.02,
            POWERUP_SPAWN_RATE: 0.002,
            MAX_ENEMIES_PER_WAVE: 10,
            WAVE_ENEMY_MULTIPLIER: 1.5,
            COMBO_TIMEOUT: 2000 // 2 seconds
        };

        let mouse = { x: 0, y: 0 };
        let particles = [];
        let game;
        let comboTimer;

        // ===================================
        // UTILITY & EFFECT FUNCTIONS
        // ===================================

        function createParticles() {
            setInterval(() => {
                if (gameState.isGameOver || particles.length >= 50) return;
                const particle = $('<div class="particle"></div>');
                particle.css({
                    left: Math.random() * window.innerWidth,
                    animationDelay: Math.random() * 3 + 's',
                    animationDuration: (Math.random() * 3 + 2) + 's'
                });
                $('.background').append(particle);
                particles.push(particle);
                
                setTimeout(() => {
                    particle.remove();
                    particles = particles.filter(p => p !== particle);
                }, 5000);
            }, 100);
        }
        
        function updateCrosshair() {
            if (gameState.isGameOver) return;
            $('.crosshair').css({ left: mouse.x, top: mouse.y });
        }

        function showDamageNumber(x, y, damage) {
            const damageEl = $(`<div class="damage-number">-${damage}</div>`);
            damageEl.css({ left: x, top: y });
            $('.container').append(damageEl);
            setTimeout(() => damageEl.remove(), 1000);
        }

        function createExplosion(x, y) {
            const explosion = $('<div class="explosion"></div>');
            explosion.css({ left: x, top: y });
            $('.container').append(explosion);
            setTimeout(() => explosion.remove(), 500);
        }

        function showCombo() {
            if (gameState.combo > 2) {
                const comboEl = $(`<div class="combo">COMBO x${gameState.combo}!</div>`);
                $('body').append(comboEl);
                setTimeout(() => comboEl.remove(), 1000);
            }
        }
        
        function checkAchievements() {
            if (gameState.score >= 1000 && !gameState.achievements.has("Novice Slayer")) {
                showAchievement("Novice Slayer (1000 Pts)");
                gameState.achievements.add("Novice Slayer");
            }
            if (gameState.wave >= 5 && !gameState.achievements.has("Wave Master")) {
                showAchievement("Wave Master (Wave 5)");
                gameState.achievements.add("Wave Master");
            }
             if (gameState.combo >= 10 && !gameState.achievements.has("Combo King")) {
                showAchievement("Combo King (x10 Combo)");
                gameState.achievements.add("Combo King");
            }
        }

        function showAchievement(text) {
            const achievement = $(`<div class="achievement">🏆 Achievement: ${text}</div>`);
            $('body').append(achievement);
            setTimeout(() => achievement.remove(), 4000);
        }
        
        function createFlash(x, y) {
            const flash = $('<div class="flash"></div>').css({ left: x, top: y });
            $('.container').append(flash);
            setTimeout(() => flash.remove(), 200);
        }
        
        function createSmoke(x, y, count) {
            for (let i = 0; i < count; i++) {
                const size = Math.random() * 20 + 10;
                const cloud = $('<div class="cloud"></div>').css({
                    left: x + (Math.random() - 0.5) * 30,
                    top: y + (Math.random() - 0.5) * 30,
                    width: size,
                    height: size,
                    animationDuration: (Math.random() * 0.5 + 0.5) + 's'
                });
                $('.container').append(cloud);
                setTimeout(() => cloud.remove(), 1000);
            }
        }
        
        function updateUI() {
            $('#score').text(gameState.score);
            $('#health-fill').css('width', gameState.health + '%');
            $('#ammo').text(game.player.ammo);
            $('#wave').text(gameState.wave);
        }
        
        // ===================================
        // CONTROLS HANDLER
        // ===================================
        class Controls {
            constructor() {
                this.keys = {};
                // Desktop Controls
                $(window).on('keydown', e => this.keys[e.key.toLowerCase()] = true);
                $(window).on('keyup', e => this.keys[e.key.toLowerCase()] = false);
                $(window).on('mousedown', () => this.keys['mousedown'] = true);
                $(window).on('mouseup', () => this.keys['mousedown'] = false);

                // Mobile Controls (akan di-setup di bawah)
                this.joystick = { active: false, angle: 0, power: 0 };
            }

            isDown(key) { return this.keys[key] || false; }
        }
        
        // ===================================
        // GAME OBJECT CLASSES
        // ===================================

        // Enhanced Player Class
        class Player {
            constructor(options) {
                this.controls = options.controls;
                this.game = options.game;
                this.createElement(options.parentContainer);

                this.x = window.innerWidth / 2;
                this.y = window.innerHeight / 2;
                this.xvel = 0;
                this.yvel = 0;
                this.friction = 0.9;
                this.speed = SETTINGS.PLAYER_SPEED;
                this.scaleX = 1;
                this.width = 50;
                this.height = 60;
                this.maxHealth = 100;
                this.ammo = 30;
                this.maxAmmo = 30;
                this.speedBoost = 1;
                this.speedBoostTimer = 0;
                this.lastShot = 0;
                this.shootCooldown = 150; // milliseconds
                this.aimAngle = 0;

                this.anim = {
                    counter: 0,
                    inc: Math.PI / 8,
                    rightArm: { rot: 0, offsetX: 0, offsetY: 0 },
                    leftArm: { rot: 0 },
                    leftLeg: { rot: 0 },
                    rightLeg: { rot: 0 },
                    gun: { rot: 0 },
                    lift: 0,
                    knockback: 0,
                };
            }

            createElement(parentContainer) {
                this.el = $(`
                    <div class="player">
                        <div class="body">
                           <div class='hat'></div>
                            <div class='eye right'></div>
                            <div class='eye left'></div>
                            <div class='mouth'></div>
                            <div class='shirt'>
                                <div class='under'></div>
                            </div>
                        </div>
                        <div class='arm right'>
                            <div class='gun'></div>
                        </div>
                        <div class='arm left'></div>
                        <div class='leg right'><div class='pant'></div></div>
                        <div class='leg left'><div class='pant'></div></div>
                    </div>
                `);
                parentContainer.append(this.el);
            }

            takeDamage(damage) {
                gameState.health = Math.max(0, gameState.health - damage);
                if (gameState.health <= 0) {
                    this.die();
                }
            }

            heal(amount) {
                gameState.health = Math.min(this.maxHealth, gameState.health + amount);
            }

            addAmmo(amount) {
                this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
            }

            speedBoostPowerup() {
                this.speedBoost = 1.8;
                this.speedBoostTimer = 300; // 5 seconds at 60fps
            }

            die() {
                if (gameState.isGameOver) return;
                gameState.isGameOver = true;
                this.el.hide();
                createExplosion(this.x, this.y);
                $('#final-score').text(gameState.score);
                $('#game-over').fadeIn();
                $('.crosshair').hide();
            }
            
            shoot() {
                const now = Date.now();
                // --- PERUBAHAN: Cek tombol 'fire' dari mobile juga ---
                if ((this.controls.isDown('mousedown') || this.controls.isDown('fire')) && this.ammo > 0 && now - this.lastShot > this.shootCooldown) {
                    this.lastShot = now;
                    this.ammo--;
                    gameState.ammo = this.ammo;
                    
                    const armRotation = isMobile ? this.aimAngle : this.anim.rightArm.rot;
                    const gunTipX = this.x + Math.cos(armRotation) * 25;
                    const gunTipY = this.y + Math.sin(armRotation) * 25;

                    this.game.addBullet(new Bullet({
                        x: gunTipX,
                        y: gunTipY,
                        angle: armRotation,
                        parentContainer:
                        this.game.container
                    }));

                    createFlash(gunTipX, gunTipY);
                    createSmoke(gunTipX, gunTipY, 3);
                    this.anim.knockback = SETTINGS.SHOOT_KNOCKBACK;
                    if (!isMobile) $('.crosshair').addClass('active');
                } else {
                    if (!isMobile) $('.crosshair').removeClass('active');
                }
            }
            
            move() {
                // --- PERUBAHAN: Logika gerak dikontrol joystick di mobile ---
                if (isMobile && this.controls.joystick.active) {
                    this.xvel = Math.cos(this.controls.joystick.angle) * this.speed * this.controls.joystick.power;
                    this.yvel = Math.sin(this.controls.joystick.angle) * this.speed * this.controls.joystick.power;
                } else if (!isMobile) {
                    this.xvel = 0;
                    this.yvel = 0;
                    if (this.controls.isDown('a') || this.controls.isDown('arrowleft')) this.xvel -= this.speed;
                    if (this.controls.isDown('d') || this.controls.isDown('arrowright')) this.xvel += this.speed;
                    if (this.controls.isDown('w') || this.controls.isDown('arrowup')) this.yvel -= this.speed;
                    if (this.controls.isDown('s') || this.controls.isDown('arrowdown')) this.yvel += this.speed;
                } else {
                    this.xvel = 0;
                    this.yvel = 0;
                }
                
                this.x += this.xvel * this.speedBoost;
                this.y += this.yvel * this.speedBoost;
            }

            // --- FUNGSI BARU: AUTO AIM ---
            autoAim() {
                let closestEnemy = null;
                let minDistance = Infinity;

                this.game.enemies.forEach(enemy => {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestEnemy = enemy;
                    }
                });

                if (closestEnemy) {
                    const dx = closestEnemy.x - this.x;
                    const dy = closestEnemy.y - this.y;
                    this.aimAngle = Math.atan2(dy, dx);
                    this.anim.rightArm.rot = this.aimAngle;
                    this.scaleX = (closestEnemy.x < this.x) ? -1 : 1;
                } else {
                    // Jika tidak ada musuh, arahkan ke depan sesuai gerakan
                    if (this.controls.joystick.active) {
                        this.aimAngle = this.controls.joystick.angle;
                        this.anim.rightArm.rot = this.aimAngle;
                    }
                    this.scaleX = (Math.cos(this.aimAngle) < 0) ? -1 : 1;
                }
            }
            
            aim() {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                this.anim.rightArm.rot = Math.atan2(dy, dx);
            }
            
            turn() {
                if(isMobile) return;
                this.scaleX = (mouse.x < this.x) ? -1 : 1;
            }
            
            boundaries() {
                if (this.x < this.width / 2) this.x = this.width / 2;
                if (this.x > window.innerWidth - this.width / 2) this.x = window.innerWidth - this.width / 2;
                if (this.y < this.height / 2) this.y = this.height / 2;
                if (this.y > window.innerHeight - this.height / 2) this.y = window.innerHeight - this.height / 2;
            }
            
            animate() {
                const isMoving = Math.abs(this.xvel) + Math.abs(this.yvel) > 0.5;

                if (isMoving) {
                    this.anim.counter += this.anim.inc;
                    this.anim.lift = Math.sin(this.anim.counter) * 4;
                    this.anim.leftArm.rot = Math.sin(this.anim.counter) / 2;
                    this.anim.rightLeg.rot = Math.sin(this.anim.counter * 0.9) * 0.6;
                    this.anim.leftLeg.rot = Math.sin(-this.anim.counter * 0.9) * 0.6;
                } else {
                    const resetSpeed = 0.15;
                    this.anim.leftArm.rot *= (1 - resetSpeed);
                    this.anim.rightLeg.rot *= (1 - resetSpeed);
                    this.anim.leftLeg.rot *= (1 - resetSpeed);
                    this.anim.lift *= (1 - resetSpeed);
                }
                
                this.anim.knockback -= this.anim.knockback * SETTINGS.SHOOT_KNOCKBACKRESET;

                const armLength = 25;
                this.anim.rightArm.offsetX = Math.cos(this.anim.rightArm.rot) * armLength;
                this.anim.rightArm.offsetY = Math.sin(this.anim.rightArm.rot) * armLength;
            }
            
            updateEffects() {
                if (this.speedBoostTimer > 0) {
                    this.speedBoostTimer--;
                    if (this.speedBoostTimer <= 0) {
                        this.speedBoost = 1;
                    }
                }
            }

            updateStyles() {
                this.el.css({
                    top: this.y + this.anim.lift,
                    left: this.x,
                    transform: `translateX(-50%) translateY(-50%) scaleX(${this.scaleX})`
                });

                this.el.find('.arm.right').css('transform', `rotate(${this.anim.rightArm.rot}rad)`);
                this.el.find('.gun').css('transform', `translateX(${-this.anim.knockback}px)`);
                this.el.find('.arm.left').css('transform', `rotate(${this.anim.leftArm.rot}rad)`);
                this.el.find('.leg.right').css('transform', `translateX(-50%) rotate(${this.anim.rightLeg.rot}rad)`);
                this.el.find('.leg.left').css('transform', `translateX(-50%) rotate(${this.anim.leftLeg.rot}rad)`);
            }
            
            update() {
                if (gameState.isGameOver) return;
                
                if (isMobile) {
                    this.autoAim();
                } else {
                    this.aim();
                }

                this.turn();
                this.move();
                this.shoot();
                this.animate();
                this.boundaries();
                this.updateEffects();
                this.updateStyles();
            }
        }
        
        class Bullet {
            constructor(options) {
                this.x = options.x;
                this.y = options.y;
                this.angle = options.angle;
                this.el = $('<div class="bullet"></div>');
                options.parentContainer.append(this.el);
                
                this.update();
            }
            
            update() {
                this.x += Math.cos(this.angle) * SETTINGS.BULLET_SPEED;
                this.y += Math.sin(this.angle) * SETTINGS.BULLET_SPEED;
                
                this.el.css({
                    left: this.x,
                    top: this.y,
                    transform: `translateX(-50%) translateY(-50%) rotate(${this.angle}rad)`
                });
            }
            
            remove() {
                this.el.remove();
            }
        }
        
        class Enemy {
            constructor(options) {
                this.game = options.game;
                this.player = options.player;
                
                const edge = Math.floor(Math.random() * 4);
                if (edge === 0) { // Top
                    this.x = Math.random() * window.innerWidth;
                    this.y = -50;
                } else if (edge === 1) { // Right
                    this.x = window.innerWidth + 50;
                    this.y = Math.random() * window.innerHeight;
                } else if (edge === 2) { // Bottom
                    this.x = Math.random() * window.innerWidth;
                    this.y = window.innerHeight + 50;
                } else { // Left
                    this.x = -50;
                    this.y = Math.random() * window.innerHeight;
                }
                
                this.type = ['jimmy', 'tank', 'speedy'][Math.floor(Math.random() * 3)];
                this.setPropertiesByType();
                
                this.el = $(`<div class="enemy ${this.type}"><div class="eye right"></div><div class="eye left"></div></div>`);
                options.parentContainer.append(this.el);
            }
            
            setPropertiesByType() {
                switch(this.type) {
                    case 'tank':
                        this.health = 50 + gameState.wave * 5;
                        this.speed = 0.5 + gameState.wave * 0.05;
                        this.score = 20;
                        this.damage = 20;
                        break;
                    case 'speedy':
                        this.health = 10 + gameState.wave * 2;
                        this.speed = 1.5 + gameState.wave * 0.1;
                        this.score = 15;
                        this.damage = 5;
                        break;
                    default: // jimmy
                        this.health = 20 + gameState.wave * 3;
                        this.speed = 1 + gameState.wave * 0.08;
                        this.score = 10;
                        this.damage = 10;
                        break;
                }
            }

            takeDamage(damage) {
                this.health -= damage;
                showDamageNumber(this.x, this.y, damage);
                this.el.addClass('hit');
                setTimeout(() => this.el.removeClass('hit'), 300);

                if (this.health <= 0) {
                    this.die();
                    return true; // Is dead
                }
                return false; // Is alive
            }
            
            die() {
                gameState.score += this.score * (1 + Math.floor(gameState.combo / 5)); // Score bonus for combo
                
                // Combo logic
                gameState.combo++;
                clearTimeout(comboTimer);
                showCombo();
                comboTimer = setTimeout(() => {
                    gameState.combo = 0;
                }, SETTINGS.COMBO_TIMEOUT);
                
                createExplosion(this.x, this.y);
                this.el.addClass('dying');
                setTimeout(() => this.el.remove(), 500);
            }
            
            update() {
                const dx = this.player.x - this.x;
                const dy = this.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
                
                this.el.css({
                    left: this.x,
                    top: this.y,
                    transform: `translateX(-50%) translateY(-50%) rotate(${Math.atan2(dy,dx)}rad)`
                });
            }
            
            remove() {
                this.el.remove();
            }
        }
        
        class Powerup {
            constructor(options) {
			this.x = options.x;
			this.y = options.y;

			if (options.forceType) {
				this.type = options.forceType;
			} else {
				const lootTable = ['ammo', 'ammo', 'ammo', 'health', 'speed']; // Ammo 3x lebih mungkin
				this.type = lootTable[Math.floor(Math.random() * lootTable.length)]; // Kembali ke peluang normal
			}
			
			this.el = $(`<div class="powerup ${this.type}"></div>`);
			options.parentContainer.append(this.el);
			
			this.el.css({ left: this.x, top: this.y });
}
            
            apply(player) {
                switch(this.type) {
                    case 'health': player.heal(30); break;
                    case 'ammo': player.addAmmo(30); break;
                    case 'speed': player.speedBoostPowerup(); break;
                }
            }
            
            remove() {
                this.el.remove();
            }
        }
        
        
        // ===================================
        // MAIN GAME CLASS
        // ===================================
        class Game {
            constructor() {
                this.container = $('.container');
                this.controls = new Controls();
                this.player = new Player({
                    controls: this.controls,
                    parentContainer: this.container,
                    game: this
                });
                this.bullets = [];
                this.enemies = [];
                this.powerups = [];
                this.enemiesToSpawn = 0;
                this.lastSpawn = 0;
                
                this.startWave();
            }
            
            startWave() {
                this.enemiesToSpawn = Math.floor(SETTINGS.MAX_ENEMIES_PER_WAVE * (1 + (gameState.wave - 1) / 2));
            }
            
            addBullet(bullet) {
                this.bullets.push(bullet);
            }
            
            spawnEnemy() {
                if (this.enemiesToSpawn > 0 && this.enemies.length < SETTINGS.MAX_ENEMIES_PER_WAVE * 2) {
                     this.enemies.push(new Enemy({
                        game: this,
                        player: this.player,
                        parentContainer: this.container
                    }));
                    this.enemiesToSpawn--;
                }
            }
            
            spawnPowerup(x, y) {
                 if (Math.random() < 0.3) { // 30% chance to drop powerup on enemy death
                     this.powerups.push(new Powerup({
                        x: x,
                        y: y,
                        parentContainer: this.container
                    }));
                 }
            }
            
            checkCollisions() {
                // Bullets vs Enemies
                this.bullets.forEach((bullet, bIndex) => {
                    this.enemies.forEach((enemy, eIndex) => {
                        const dx = bullet.x - enemy.x;
                        const dy = bullet.y - enemy.y;
                        if (Math.sqrt(dx * dx + dy * dy) < 30) {
                            bullet.remove();
                            this.bullets.splice(bIndex, 1);
                            if(enemy.takeDamage(10)) { // if enemy dies
                                this.spawnPowerup(enemy.x, enemy.y);
                                this.enemies.splice(eIndex, 1);
                            }
                        }
                    });
                });
                
                // Player vs Enemies
                this.enemies.forEach((enemy, eIndex) => {
                    const dx = this.player.x - enemy.x;
                    const dy = this.player.y - enemy.y;
                    if (Math.sqrt(dx * dx + dy * dy) < 40) {
                        enemy.die();
                        this.enemies.splice(eIndex, 1);
                        this.player.takeDamage(enemy.damage);
                    }
                });

                // Player vs Powerups
                this.powerups.forEach((powerup, pIndex) => {
                     const dx = this.player.x - powerup.x;
                     const dy = this.player.y - powerup.y;
                     if (Math.sqrt(dx*dx + dy*dy) < 40) {
                         powerup.apply(this.player);
                         powerup.remove();
                         this.powerups.splice(pIndex, 1);
                     }
                });
            }

            loop() {
                if (gameState.isGameOver) return;
                
                // Update objects
                this.player.update();
                this.bullets.forEach((b, i) => {
                    b.update();
                    if (b.x < 0 || b.x > window.innerWidth || b.y < 0 || b.y > window.innerHeight) {
                        b.remove();
                        this.bullets.splice(i, 1);
                    }
                });
                this.enemies.forEach(e => e.update());
                
                // Spawning
                const now = Date.now();
                if (now - this.lastSpawn > 1000) { // Spawn every second
                    this.lastSpawn = now;
                    this.spawnEnemy();
                }

                // Check collisions and state
                this.checkCollisions();
                
                // Check for next wave
                if(this.enemiesToSpawn <= 0 && this.enemies.length === 0) {
                    gameState.wave++;
                    this.startWave();
                }
                
                updateUI();
                updateCrosshair();
                checkAchievements();
                
                requestAnimationFrame(this.loop.bind(this));
            }
        }
        
        function startGame() {
            // Reset game state
            gameState = {
                score: 0,
                health: 100,
                ammo: 30,
                wave: 1,
                combo: 0,
                isGameOver: false,
                achievements: new Set()
            };
            
            // Clear old game elements
            $('.container').empty();
            $('.game-over').hide();
            $('.crosshair').show();
            
            game = new Game();
			game.loop();
        }
        
        // ===================================
        // EVENT LISTENERS & GAME START
        // ===================================
        $(window).on('mousemove', e => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        $('#restart-btn').on('click', startGame);

        // --- LOGIKA BARU: SETUP KONTROL MOBILE ---
        function setupMobileControls() {
            if (!isMobile) return;

            const fireButton = $('#fire-button');
            const joystickBase = $('#joystick-base');
            const joystickKnob = $('#joystick-knob');
            const baseRect = joystickBase[0].getBoundingClientRect();
            const baseRadius = baseRect.width / 2;
            const baseCenterX = baseRect.left + baseRadius;
            const baseCenterY = baseRect.top + baseRadius;
            
            // Tombol Tembak
            fireButton.on('touchstart', (e) => {
                e.preventDefault();
                game.controls.keys['fire'] = true;
            });
            fireButton.on('touchend touchcancel', (e) => {
                e.preventDefault();
                game.controls.keys['fire'] = false;
            });

            // Joystick
            joystickBase.on('touchstart touchmove', (e) => {
        e.preventDefault();
        game.controls.joystick.active = true;
        const touch = e.originalEvent.touches[0];

        // --- PINDAHKAN KALKULASI KE SINI ---
        const baseRect = joystickBase[0].getBoundingClientRect();
        const baseRadius = baseRect.width / 2;
        const baseCenterX = baseRect.left + baseRadius;
        const baseCenterY = baseRect.top + baseRadius;
        // ------------------------------------

        let deltaX = touch.clientX - baseCenterX;
        let deltaY = touch.clientY - baseCenterY;
        
        let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        let angle = Math.atan2(deltaY, deltaX);
        
        game.controls.joystick.angle = angle;
        game.controls.joystick.power = Math.min(1, distance / baseRadius);

        if (distance > baseRadius) {
            deltaX = Math.cos(angle) * baseRadius;
            deltaY = Math.sin(angle) * baseRadius;
        }
        
        joystickKnob.css('transform', `translate(-50%, -50%) translate(${deltaX}px, ${deltaY}px)`);
    });

            joystickBase.on('touchend touchcancel', (e) => {
        e.preventDefault();
        game.controls.joystick.active = false;
        joystickKnob.css('transform', `translate(-50%, -50%)`);
    });
        }
        
        // Initial setup
        createParticles();
        startGame();
        setupMobileControls();
	});
    
    // Global restart function (accessible from HTML onclick)
    function restartGame() {
        $('#restart-btn').click();
    }
