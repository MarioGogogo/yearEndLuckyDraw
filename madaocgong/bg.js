/**
 * Background Animation - bg.js
 * Creates a dynamic canvas background with traditional Chinese stylized clouds
 * and gold sparkles to simulate forward motion/speed.
 */

const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let clouds = [];
let speed = 2; // Base speed
let targetSpeed = 2;
let animationFrameId;

// Resize handling
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Particle Class (Gold Dust)
class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 2 + 1; // Horizontal speed
        this.alpha = Math.random() * 0.5 + 0.2;
    }

    update(currentSpeed) {
        this.x -= this.speedX * currentSpeed;
        
        // Wrap around
        if (this.x < 0) {
            this.x = width + Math.random() * 100;
            this.y = Math.random() * height;
        }
    }

    draw() {
        ctx.fillStyle = `rgba(255, 215, 0, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Cloud Class (Simplified stylized clouds)
class Cloud {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.width = Math.random() * 200 + 100;
        this.height = this.width * 0.6;
        this.speedX = Math.random() * 0.5 + 0.2;
        this.opacity = Math.random() * 0.1 + 0.05;
    }

    update(currentSpeed) {
        this.x -= this.speedX * currentSpeed * 0.5; // Clouds move slower parallax
        
        if (this.x + this.width < 0) {
            this.x = width + Math.random() * 200;
            this.y = Math.random() * height;
        }
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = '#FFF8D6'; // Light goldish cream
        
        // Draw a simple cloud shape using ellipses
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Initialize Elements
function init() {
    particles = [];
    clouds = [];
    
    // Create gold dust
    for (let i = 0; i < 100; i++) {
        particles.push(new Particle());
    }

    // Create clouds
    for (let i = 0; i < 15; i++) {
        clouds.push(new Cloud());
    }
}

// Animation Loop
function animate() {
    ctx.clearRect(0, 0, width, height);
    
    // Gradient Background (Red to Dark)
    const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    gradient.addColorStop(0, '#D20F15');
    gradient.addColorStop(0.8, '#8E0000');
    gradient.addColorStop(1, '#580507');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Lerp speed for smooth transition
    speed += (targetSpeed - speed) * 0.1;

    // Draw Clouds (Background layer)
    clouds.forEach(cloud => {
        cloud.update(speed);
        cloud.draw();
    });

    // Draw Particles (Foreground layer)
    particles.forEach(p => {
        p.update(speed);
        p.draw();
    });

    animationFrameId = requestAnimationFrame(animate);
}

// Public API to control background speed
window.setBackgroundSpeed = (newSpeed) => {
    targetSpeed = newSpeed;
};

init();
animate();
