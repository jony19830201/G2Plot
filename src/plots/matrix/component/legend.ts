import { each, isArray, isFunction, deepMix, clone } from '@antv/util';
import { Group, BBox, Shape } from '@antv/g';
import { View, Scale } from '@antv/g2';

export interface MatrixLegendConfig {
  visible?: boolean;
  position?: string;
  width?: number;
  height?: number;
  text?: {
    style: any;
    formatter: () => string;
  };
  gridlineStyle?: any;
  triggerOn?: string;
}

export interface IMatrixLegend extends MatrixLegendConfig {
  view: View;
  plot: any;
}

export default class MatrixLegend {
  public options: IMatrixLegend;
  public container: Group;
  public anchor: Shape;
  protected view: View;
  protected layout: string;
  protected width: number;
  protected height: number;
  protected position: string;
  protected x: number;
  protected y: number;
  protected dataSlides: any = {};
  protected colorScale: any;

  constructor(cfg: IMatrixLegend) {
    const defaultOptions = this.getDefaultOptions();
    this.options = deepMix({}, defaultOptions, cfg);
    this.view = this.options.view;
    this.init();
  }

  public init() {
    this.layout = this.getLayout();
    this.width = this.options.width ? this.options.width : this.getDefaultWidth();
    this.height = this.options.height ? this.options.height : this.getDefaultHeight();
    const plotContainer = this.options.plot.container;
    this.container = plotContainer.addGroup();
  }

  public render() {
    const scales = this.view.get('scales');
    const colorField = this.options.plot.options.colorField;
    this.colorScale = scales[colorField];
    const { min, max } = this.colorScale;
    const { color } = this.options.plot.options;
    if (this.layout === 'horizontal') {
      this.renderHorizontal(min, max, color);
    } else {
      this.renderVertical(min, max, color);
    }
    this.legendLayout();
    this.addInteraction();
  }

  public clear() {
    if (this.container) {
      this.container.clear();
    }
  }

  public destroy() {
    if (this.container) {
      this.container.remove();
    }
  }

  public getBBox() {
    const origin_bbox = this.container.getBBox();
    return new BBox(this.x, this.y, origin_bbox.width, origin_bbox.height);
  }

  protected renderVertical(min, max, colors) {
    const valueStep = (max - min) / (colors.length - 1);
    const colorStep = 1 / (colors.length - 1);
    const tickStep = this.height / (colors.length - 1);
    let gradientColor = 'l(90)';
    each(colors, (c, index) => {
      const stepNum = colorStep * index;
      gradientColor += `${stepNum}:${c} `;
    });
    this.container.addShape('rect', {
      attrs: {
        x: 0,
        y: 0,
        width: this.width,
        height: this.height,
        fill: gradientColor,
      },
    });
    // draw tick and label
    each(colors, (c, index) => {
      // tick
      const step = tickStep * index;
      this.container.addShape('path', {
        attrs: {
          path: [
            ['M', 0, step],
            ['L', this.width, step],
          ],
          stroke: 'black',
          lineWidth: 1,
          opacity: 0.5,
        },
      });
      // value
      const value = Math.round(valueStep * index);
      this.container.addShape('text', {
        attrs: {
          text: value,
          fill: 'rgba(0,0,0,0.5)',
          fontSize: 12,
          textAlign: 'left',
          textBaseline: 'middle',
          x: this.width + 4,
          y: step,
        },
      });
    });
    //scroll bar
    const tri_width = 10;
    const tri_height = 14;
    const tri_path = [['M', -tri_width, -tri_height / 2], ['L', 0, 0], ['L', -tri_width, tri_height / 2], ['Z']];
    this.anchor = this.container.addShape('path', {
      attrs: {
        path: tri_path,
        fill: 'rgba(0,0,0,0.5)',
      },
    });
  }

  protected renderHorizontal(min, max, colors) {
    const gridWidth = this.width / colors.length;
    const gridHeight = this.height;
    const gridLineContainer = new Group();
    const valueStep = (max - min) / colors.length;
  }

  protected getLayout() {
    const positions = this.options.position.split('-');
    this.position = positions[0];
    if (positions[0] === 'left' || positions[0] === 'right') {
      return 'vertical';
    }
    return 'horizontal';
  }

  protected getDefaultWidth() {
    if (this.layout === 'horizontal') {
      const { width } = this.options.plot.options;
      return width * 0.5;
    }
    return 10;
  }

  protected getDefaultHeight() {
    if (this.layout === 'vertical') {
      const height = this.view.get('panelRange').height;
      return height;
    }
    return 10;
  }

  protected legendLayout() {
    const panelRange = this.view.get('panelRange');
    const { bleeding } = this.options.plot.getPlotTheme();
    if (isArray(bleeding)) {
      each(bleeding, (it, index) => {
        if (typeof bleeding[index] === 'function') {
          bleeding[index] = bleeding[index](this.options.plot.options);
        }
      });
    }
    const bbox = this.container.getBBox();
    let x = 0;
    let y = 0;
    const positions = this.options.position.split('-');
    const plotWidth = this.options.plot.width;
    const plotHeight = this.options.plot.height;
    // 先确定x
    if (positions[0] === 'left') {
      x = bleeding[3];
    } else if (positions[0] === 'right') {
      x = plotWidth - bleeding[1] - bbox.width;
    } else if (positions[1] === 'center') {
      x = (plotWidth - bbox.width) / 2;
    } else if (positions[1] === 'left') {
      x = bleeding[3];
    } else if (positions[1] === 'right') {
      x = this.options.plot.width - bleeding[1] - bbox.width;
    }
    // 再确定y
    if (positions[0] === 'bottom') {
      y = plotHeight - bleeding[2] - bbox.height;
    } else if (positions[0] === 'top') {
      y = bleeding[0];
    } else if (positions[1] === 'center') {
      // default
      if (this.height === panelRange.height) {
        y = panelRange.y;
      } else {
        //用户自行设定
        y = (plotHeight - bbox.height) / 2;
      }
    } else if (positions[1] === 'top') {
      y = bleeding[0];
    } else if (positions[1] === 'bottom') {
      y = plotHeight - bleeding[2] - bbox.height;
    }

    this.x = x;
    this.y = y;

    this.container.translate(x, y);
  }

  protected getDefaultOptions() {
    return {
      text: {
        style: {
          fontSize: 12,
          fill: 'rgba(0, 0, 0, 0.45)',
        },
      },
      gridlineStyle: {
        lineWidth: 1,
        stroke: 'rgba(0, 0, 0, 0.45)',
      },
      triggerOn: 'mousemove',
    };
  }

  protected addInteraction() {
    let geomType;
    if (this.options.plot.options.shapeType === 'rect') {
      geomType = 'polygon';
    } else {
      geomType = 'point';
    }

    const eventName = `${geomType}:${this.options.triggerOn}`;
    const labelEventName = `label:${this.options.triggerOn}`;
    const field = this.options.plot.options.colorField;
    const { min, max } = this.colorScale;

    this.view.on(eventName, (ev) => {
      const value = ev.data._origin[field];
      const ratio = (value - min) / (max - min);
      this.moveAnchor(ratio);
    });

    this.view.on(labelEventName, (ev) => {
      const value = ev.data[field];
      const ratio = (value - min) / (max - min);
      this.moveAnchor(ratio);
    });
  }

  private moveAnchor(ratio) {
    if (this.layout === 'vertical') {
      const pos = this.height * ratio;
      const ulMatrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      ulMatrix[7] = pos;
      this.anchor.stopAnimate();
      this.anchor.animate(
        {
          matrix: ulMatrix,
        },
        400,
        'easeLinear'
      );
    }
  }
}
