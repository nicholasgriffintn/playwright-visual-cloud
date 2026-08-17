declare module "pngjs" {
  export interface PngOptions {
    width: number;
    height: number;
  }

  export class PNG {
    width: number;
    height: number;
    data: Uint8Array;

    constructor(options: PngOptions);

    static bitblt(
      source: PNG,
      target: PNG,
      sourceX: number,
      sourceY: number,
      sourceWidth: number,
      sourceHeight: number,
      targetX: number,
      targetY: number,
    ): void;

    static sync: {
      read(buffer: ArrayBuffer | ArrayBufferView | Buffer): PNG;
      write(png: PNG): Buffer;
    };
  }
}
