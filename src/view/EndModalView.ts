import { Container, Graphics, Text } from 'pixi.js';
import { parseColor } from './utils/color';

type EndModalOptions = {
  width?: number;
  height?: number;
  cornerRadius?: number;
  backgroundColor?: string;
  onAction?: () => void;
  titleWin?: string;
  titleLose?: string;
  actionWin?: string;
  actionLose?: string;
};

export class EndModalView extends Container {
  private panel: Graphics;
  private title: Text;
  private button: Graphics;
  private buttonLabel: Text;
  private onAction?: () => void;
  private panelWidth: number;
  private panelHeight: number;
  private cornerRadius: number;
  private bgColor: number;
  private titleWin: string;
  private titleLose: string;
  private actionWin: string;
  private actionLose: string;

  constructor(opts: EndModalOptions = {}) {
    super();
    this.sortableChildren = true;

    this.panelWidth = opts.width ?? 420;
    this.panelHeight = opts.height ?? 240;
    this.cornerRadius = opts.cornerRadius ?? 16;
    this.bgColor = parseColor(opts.backgroundColor ?? '#FAFAFA');
    this.onAction = opts.onAction;
    this.titleWin = opts.titleWin ?? 'vitória';
    this.titleLose = opts.titleLose ?? 'fim de jogo';
    this.actionWin = opts.actionWin ?? 'next stage';
    this.actionLose = opts.actionLose ?? 'play again';

    this.panel = new Graphics();
    this.title = new Text({
      text: '',
      style: {
        fontFamily: 'Arial',
        fontSize: 36,
        fill: 0x222222,
        align: 'center',
      },
    });
    this.button = new Graphics();
    this.buttonLabel = new Text({
      text: '',
      style: {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0xffffff,
        align: 'center',
      },
    });

    this.addChild(this.panel, this.title, this.button, this.buttonLabel);
    this.draw();
    this.setupInteractions();
  }

  setContent(isWin: boolean) {
    const titleText = isWin ? this.titleWin : this.titleLose;
    const btnText = isWin ? this.actionWin : this.actionLose;
    this.title.text = titleText;
    this.buttonLabel.text = btnText;
    this.layoutChildren();
  }

  setStrings(opts: {
    titleWin?: string;
    titleLose?: string;
    actionWin?: string;
    actionLose?: string;
  }) {
    if (opts.titleWin !== undefined) this.titleWin = opts.titleWin;
    if (opts.titleLose !== undefined) this.titleLose = opts.titleLose;
    if (opts.actionWin !== undefined) this.actionWin = opts.actionWin;
    if (opts.actionLose !== undefined) this.actionLose = opts.actionLose;
  }

  setOnAction(cb: (() => void) | undefined) {
    this.onAction = cb;
  }

  setSize(width: number, height: number) {
    this.panelWidth = width;
    this.panelHeight = height;
    this.draw();
    this.layoutChildren();
  }

  private draw() {
    this.panel
      .clear()
      .roundRect(0, 0, this.panelWidth, this.panelHeight, this.cornerRadius)
      .fill({ color: this.bgColor });
    this.pivot.set(this.panelWidth / 2, this.panelHeight / 2);
  }

  private layoutChildren() {
    this.title.anchor.set(0.5, 0.5);
    this.title.position.set(this.panelWidth / 2, this.panelHeight * 0.33);

    const btnWidth = Math.min(280, this.panelWidth - 80);
    const btnHeight = 56;
    const x = (this.panelWidth - btnWidth) / 2;
    const y = this.panelHeight - btnHeight - 32;
    this.button
      .clear()
      .roundRect(x, y, btnWidth, btnHeight, Math.min(14, btnHeight * 0.3))
      .fill({ color: 0x2b80ff });
    this.buttonLabel.anchor.set(0.5, 0.5);
    this.buttonLabel.position.set(this.panelWidth / 2, y + btnHeight / 2);
  }

  private setupInteractions() {
    this.eventMode = 'passive';
    this.button.eventMode = 'static';
    this.button.cursor = 'pointer';
    this.button.on('pointertap', () => {
      this.onAction?.();
    });
  }
}
