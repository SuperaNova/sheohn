<script lang="ts">
  import { onMount } from 'svelte';

  let canvas = $state<HTMLCanvasElement | null>(null);
  let ctx: CanvasRenderingContext2D | null = null;
  let animationFrameId = 0;

  const PADDLE_WIDTH = 10;
  const PADDLE_HEIGHT = 80;
  const BALL_SIZE = 10;

  const width = 600;
  const height = 400;

  let playerY = 160;
  let aiY = 160;
  let ballX = 300;
  let ballY = 200;
  let ballSpeedX = 5;
  let ballSpeedY = 5;

  let playerScore = $state(0);
  let aiScore = $state(0);
  let playing = $state(false);

  function resetBall() {
    ballX = width / 2;
    ballY = height / 2;
    ballSpeedX = -ballSpeedX;
    ballSpeedY = (Math.random() > 0.5 ? 1 : -1) * 5;
  }

  // Imperfect tracking: only nudges toward the ball, never snaps to it.
  function updateAI() {
    const aiCenter = aiY + PADDLE_HEIGHT / 2;
    if (aiCenter < ballY - 10) {
      aiY += 4;
    } else if (aiCenter > ballY + 10) {
      aiY -= 4;
    }
    aiY = Math.max(0, Math.min(height - PADDLE_HEIGHT, aiY));
  }

  function updateBallPosition() {
    if (playing) {
      ballX += ballSpeedX;
      ballY += ballSpeedY;
    }
  }

  function bounceOffWalls() {
    if (ballY <= 0 || ballY + BALL_SIZE >= height) {
      ballSpeedY = -ballSpeedY;
    }
  }

  // Shared by both paddles: reverse X, pin the ball to the paddle face
  // (prevents sticking), and steer the return angle by where it was hit.
  function bounceOffPaddle(paddleY: number, clampedBallX: number) {
    ballSpeedX = -ballSpeedX;
    ballX = clampedBallX;
    const deltaY = ballY - (paddleY + PADDLE_HEIGHT / 2);
    ballSpeedY = deltaY * 0.2;
  }

  function checkPlayerPaddleCollision() {
    if (
      ballX <= PADDLE_WIDTH * 2 &&
      ballY + BALL_SIZE >= playerY &&
      ballY <= playerY + PADDLE_HEIGHT
    ) {
      bounceOffPaddle(playerY, PADDLE_WIDTH * 2);
    }
  }

  function checkAiPaddleCollision() {
    if (
      ballX + BALL_SIZE >= width - PADDLE_WIDTH * 2 &&
      ballY + BALL_SIZE >= aiY &&
      ballY <= aiY + PADDLE_HEIGHT
    ) {
      bounceOffPaddle(aiY, width - PADDLE_WIDTH * 2 - BALL_SIZE);
    }
  }

  function pauseAfterScore() {
    resetBall();
    playing = false;
    setTimeout(() => (playing = true), 1000);
  }

  function checkScoring() {
    if (ballX < 0) {
      aiScore++;
      pauseAfterScore();
    } else if (ballX > width) {
      playerScore++;
      pauseAfterScore();
    }
  }

  function drawPaddle(x: number, y: number, color: string) {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, PADDLE_WIDTH, PADDLE_HEIGHT);
  }

  function draw() {
    if (!ctx) return;

    // Transparent clear so the div background shows through.
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(150, 150, 150, 0.2)';
    ctx.beginPath();
    ctx.setLineDash([10, 15]);
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    drawPaddle(PADDLE_WIDTH, playerY, '#10b981'); // player: tertiary/green
    drawPaddle(width - PADDLE_WIDTH * 2, aiY, '#ef4444'); // AI: error/red

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(
      ballX + BALL_SIZE / 2,
      ballY + BALL_SIZE / 2,
      BALL_SIZE / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.15)';
    ctx.textAlign = 'right';
    ctx.fillText(playerScore.toString(), width / 2 - 40, 60);
    ctx.textAlign = 'left';
    ctx.fillText(aiScore.toString(), width / 2 + 40, 60);
  }

  function gameLoop() {
    if (!ctx) return;

    updateAI();
    updateBallPosition();
    bounceOffWalls();
    checkPlayerPaddleCollision();
    checkAiPaddleCollision();
    checkScoring();
    draw();

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Scale coordinates if canvas style width doesn't match attribute width
    const scaleY = canvas.height / rect.height;
    const mouseY = (e.clientY - rect.top) * scaleY;
    playerY = Math.max(
      0,
      Math.min(height - PADDLE_HEIGHT, mouseY - PADDLE_HEIGHT / 2),
    );
    if (!playing) playing = true;
  }

  function handleTouchMove(e: TouchEvent) {
    const touch = e.touches[0];
    if (!canvas || !touch) return;
    e.preventDefault(); // prevent scrolling
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const touchY = (touch.clientY - rect.top) * scaleY;
    playerY = Math.max(
      0,
      Math.min(height - PADDLE_HEIGHT, touchY - PADDLE_HEIGHT / 2),
    );
    if (!playing) playing = true;
  }

  onMount(() => {
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Set internal resolution strictly
    canvas.width = width;
    canvas.height = height;

    // Svelte 5 removed event modifiers; register touchmove manually so
    // preventDefault() works (replaces the old `on:touchmove|nonpassive`).
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    resetBall();
    playing = true;
    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas?.removeEventListener('touchmove', handleTouchMove);
    };
  });
</script>

<div
  class="relative mx-auto mt-8 w-full max-w-[600px] rounded-xl border border-[var(--color-on-surface-muted)] bg-[var(--color-surface-container)] shadow-2xl overflow-hidden aspect-[3/2]"
>
  <div
    class="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-3 text-xs font-semibold tracking-widest text-[var(--color-on-surface-muted)]"
  >
    <span>YOU</span>
    <span>SYS.AI</span>
  </div>

  <canvas
    bind:this={canvas}
    onmousemove={handleMouseMove}
    class="block w-full h-full touch-none cursor-none"
  ></canvas>

  {#if !playing && playerScore === 0 && aiScore === 0}
    <div
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span
        class="animate-pulse rounded bg-black/50 px-3 py-1 text-sm font-semibold text-white backdrop-blur"
      >
        Move mouse to start
      </span>
    </div>
  {/if}
</div>
