export interface Fabric {
  id: string
  reference: string
  name: string
  pricePerMeter: number
  width: number | null
}

export interface Product {
  family: string
  range: string
  fabric: {
    reference: string
    name: string
    pricePerMeter: number
  }
  dims: {
    L: number
    l: number
    bonnet?: number
    diametre?: number
  }
  mainFabricMeters: number
  laborMinutes: number
  totalPriceHT: number
}

export interface QuotePDFData {
  id: string
  reference: string
  totalPrice: number
  products: Product[]
}