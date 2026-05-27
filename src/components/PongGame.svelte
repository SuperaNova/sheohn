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

  function gameLoop() {
    if (!ctx) return;

    // AI Logic (imperfect tracking)
    const aiCenter = aiY + PADDLE_HEIGHT / 2;
    if (aiCenter < ballY - 10) {
      aiY += 4;
    } else if (aiCenter > ballY + 10) {
      aiY -= 4;
    }

    // Keep AI in bounds
    aiY = Math.max(0, Math.min(height - PADDLE_HEIGHT, aiY));

    // Ball movement
    if (playing) {
      ballX += ballSpeedX;
      ballY += ballSpeedY;
    }

    // Top and bottom collision
    if (ballY <= 0 || ballY + BALL_SIZE >= height) {
      ballSpeedY = -ballSpeedY;
    }

    // Player paddle collision
    if (
      ballX <= PADDLE_WIDTH * 2 &&
      ballY + BALL_SIZE >= playerY &&
      ballY <= playerY + PADDLE_HEIGHT
    ) {
      ballSpeedX = -ballSpeedX;
      ballX = PADDLE_WIDTH * 2; // prevent sticking
      // Adjust angle based on where it hits paddle
      const deltaY = ballY - (playerY + PADDLE_HEIGHT / 2);
      ballSpeedY = deltaY * 0.2;
    }

    // AI paddle collision
    if (
      ballX + BALL_SIZE >= width - PADDLE_WIDTH * 2 &&
      ballY + BALL_SIZE >= aiY &&
      ballY <= aiY + PADDLE_HEIGHT
    ) {
      ballSpeedX = -ballSpeedX;
      ballX = width - PADDLE_WIDTH * 2 - BALL_SIZE;
      const deltaY = ballY - (aiY + PADDLE_HEIGHT / 2);
      ballSpeedY = deltaY * 0.2;
    }

    // Scoring
    if (ballX < 0) {
      aiScore++;
      resetBall();
      playing = false; // pause briefly
      setTimeout(() => (playing = true), 1000);
    } else if (ballX > width) {
      playerScore++;
      resetBall();
      playing = false;
      setTimeout(() => (playing = true), 1000);
    }

    // Draw background (transparent so it shows the div background)
    ctx.clearRect(0, 0, width, height);

    // Middle dashed line
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.2)';
    ctx.beginPath();
    ctx.setLineDash([10, 15]);
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // Draw player paddle (tertiary color / green)
    ctx.fillStyle = '#10b981';
    ctx.fillRect(PADDLE_WIDTH, playerY, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw AI paddle (error color / red)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(width - PADDLE_WIDTH * 2, aiY, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw ball
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

    // Draw scores
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.15)';
    ctx.textAlign = 'right';
    ctx.fillText(playerScore.toString(), width / 2 - 40, 60);
    ctx.textAlign = 'left';
    ctx.fillText(aiScore.toString(), width / 2 + 40, 60);

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
    if (!canvas || e.touches.length === 0) return;
    e.preventDefault(); // prevent scrolling
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const touchY = (e.touches[0].clientY - rect.top) * scaleY;
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
