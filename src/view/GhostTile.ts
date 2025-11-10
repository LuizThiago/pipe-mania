import { Container, Graphics } from 'pixi.js';
import { lerp } from './utils/tween';

export class GhostTile extends Container {
	private outline?: Graphics;
	private tileSize = 64;
	private targetX = 0;
	private targetY = 0;
	private rafId?: number;
	private visibleInsideGrid = true;
	private lerpInside = 0.22;
	private lerpOutside = 0.14;
	private pulseTime = 0;
	private pulseSpeed = 0.05;
	private outlineColor = 0x2b80ff;
	private minAlpha = 0.3;
	private maxAlpha = 0.9;
	private minWidth = 2;
	private maxWidth = 4;

	constructor(opts?: { 
		lerpInside?: number; 
		lerpOutside?: number; 
		alpha?: number;
		pulseSpeed?: number;
		outlineColor?: number;
	}) {
		super();
		this.eventMode = 'none';
		if (opts?.lerpInside !== undefined) this.lerpInside = opts.lerpInside;
		if (opts?.lerpOutside !== undefined) this.lerpOutside = opts.lerpOutside;
		if (opts?.pulseSpeed !== undefined) this.pulseSpeed = opts.pulseSpeed;
		if (opts?.outlineColor !== undefined) this.outlineColor = opts.outlineColor;
		this.createOutline();
		this.startTick();
	}

	private createOutline() {
		this.outline = new Graphics();
		this.addChild(this.outline);
		this.updateOutline();
	}

	setTileSize(size: number) {
		this.tileSize = size;
		this.updateOutline();
	}

	setPipe() {
		// No longer needed as we're just showing an outline
		// Keep method signature for compatibility with GhostController
	}

	setTarget(x: number, y: number) {
		this.targetX = x;
		this.targetY = y;
	}

	setVisibleInsideGrid(visible: boolean) {
		this.visibleInsideGrid = visible;
	}

	private updateOutline() {
		if (!this.outline) return;

		// Calculate pulse effect
		const pulse = Math.sin(this.pulseTime) * 0.5 + 0.5; // 0 to 1
		const alpha = this.minAlpha + (this.maxAlpha - this.minAlpha) * pulse;
		const width = this.minWidth + (this.maxWidth - this.minWidth) * pulse;
		const cornerRadius = Math.min(12, this.tileSize * 0.12);

		// Draw rounded rect outline centered at (0,0)
		this.outline.clear();
		this.outline
			.roundRect(
				-this.tileSize / 2,
				-this.tileSize / 2,
				this.tileSize,
				this.tileSize,
				cornerRadius
			)
			.stroke({
				width: Math.max(width, this.tileSize * 0.03),
				color: this.outlineColor,
				alpha: alpha,
			});
	}

	private startTick() {
		if (this.rafId !== undefined) return;
		const step = () => {
			// Update position with lerp
			const s = this.visibleInsideGrid ? this.lerpInside : this.lerpOutside;
			this.position.set(lerp(this.x, this.targetX, s), lerp(this.y, this.targetY, s));
			
			// Update pulse animation
			this.pulseTime += this.pulseSpeed;
			this.updateOutline();
			
			this.rafId = requestAnimationFrame(step);
		};
		this.rafId = requestAnimationFrame(step);
	}

	destroy(options?: boolean | import('pixi.js').DestroyOptions): void {
		if (this.rafId !== undefined) {
			cancelAnimationFrame(this.rafId);
			this.rafId = undefined;
		}
		super.destroy(options as any);
	}
}


