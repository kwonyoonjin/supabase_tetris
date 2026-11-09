import { PIECE_TYPES, type PieceType } from './pieces';

/** 7종을 한 묶음으로 섞어 차례로 내보내는 생성기 */
export class Bag {
  private items: PieceType[] = [];

  next(): PieceType {
    if (this.items.length === 0) this.refill();
    return this.items.pop() as PieceType;
  }

  private refill(): void {
    const a = [...PIECE_TYPES];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    this.items = a;
  }
}
