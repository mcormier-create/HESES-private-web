export type OrderAckExtraction = {
  carelOrderNumber: string;
  clientPurchaseOrder: string;
  products: Array<{ sku: string; quantity: number }>;
  expectedDeliveryDate: string;
};

export class OrderAckParser {
  isOrderAcknowledgement(subject: string, body: string): boolean {
    const input = `${subject}\n${body}`;
    return /(order\s*acknowledg(e)?ment|accuse\s*de\s*reception|oa\b)/i.test(input);
  }

  parseFromText(input: string): OrderAckExtraction | null {
    const carel = input.match(/carel\s*(order|no\.?|number)?\s*[:#-]?\s*([A-Z0-9-]{4,})/i);
    const clientPo = input.match(/(client\s*po|po\s*client|purchase\s*order)\s*[:#-]?\s*([A-Z0-9-]{3,})/i);
    const date = input.match(/(delivery|livraison)\s*(date)?\s*[:#-]?\s*(\d{4}-\d{2}-\d{2})/i);

    if (!carel || !clientPo) return null;

    const products = this.extractProducts(input);

    return {
      carelOrderNumber: carel[2],
      clientPurchaseOrder: clientPo[2],
      products,
      expectedDeliveryDate: date?.[3] ?? ""
    };
  }

  private extractProducts(input: string): Array<{ sku: string; quantity: number }> {
    const matches = Array.from(
      input.matchAll(/(?:sku|product|item)\s*[:#-]?\s*([A-Z0-9-]{3,})[^\n\r]*?(?:qty|quantity|qte)\s*[:#-]?\s*(\d+)/gi)
    );

    return matches.map((match) => ({
      sku: match[1],
      quantity: Number(match[2])
    }));
  }
}
