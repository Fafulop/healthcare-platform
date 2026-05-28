export interface PdfParsedMovement {
  transactionDate: string;
  concept: string;
  reference: string;
  amount: number;
  movementType: 'deposit' | 'withdrawal';
  balance: number | null;
}

export interface ReviewItem extends PdfParsedMovement {
  selected: boolean;
  entryType: 'ingreso' | 'egreso';
  area: string;
  subarea: string;
  formaDePago: string;
}
