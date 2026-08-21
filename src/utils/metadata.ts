import { publicKey } from '@metaplex-foundation/umi';

export interface CertificateFormInputs {
  nombre: string;
  categoria: string;
  serie: string;
  anio: string;
  origen: string;
  descripcion: string;
  valor: string;
  edicion: string;
  material: string;
  acabado: string;
  garantia: string;
  peso: string;
  images: string[];
  creatorWallet: string;
}

export interface MetaplexAttribute {
  trait_type: string;
  value: string | number;
}

export interface MetaplexMetadataJson {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: MetaplexAttribute[];
  properties: {
    files: Array<{ uri: string; type: string }>;
    category: string;
    creators: Array<{ address: string; share: number }>;
  };
}

/**
 * Construye el objeto JSON conforme al estándar Metaplex Token Metadata V1 para CertChain y Pinata.
 */
export function buildCertificateMetadata(inputs: CertificateFormInputs): MetaplexMetadataJson {
  const primaryImage = inputs.images && inputs.images.length > 0 ? inputs.images[0] : 'https://gateway.pinata.cloud/ipfs/default-certificate.png';

  return {
    name: inputs.nombre || 'Certificado de Autenticidad',
    symbol: 'CERT',
    description: inputs.descripcion || 'Certificado digital inmutable de autenticidad emitido en CertChain.',
    image: primaryImage,
    external_url: 'https://certchain.app',
    attributes: [
      { trait_type: 'Categoría', value: inputs.categoria || 'Joyería' },
      { trait_type: 'Número de Serie', value: inputs.serie || '-' },
      { trait_type: 'Año de Fabricación', value: inputs.anio || new Date().getFullYear().toString() },
      { trait_type: 'País de Origen', value: inputs.origen || 'México' },
      { trait_type: 'Valor Estimado (USD)', value: inputs.valor || '0' },
      { trait_type: 'Edición / Tiraje', value: inputs.edicion || 'Pieza Única' },
      { trait_type: 'Material Principal', value: inputs.material || 'Acero inoxidable 316L' },
      { trait_type: 'Acabado', value: inputs.acabado || 'Pulido y satinado' },
      { trait_type: 'Garantía', value: inputs.garantia || '5 años' },
      { trait_type: 'Peso', value: inputs.peso || '180g' },
    ],
    properties: {
      files: [{ uri: primaryImage, type: 'image/png' }],
      category: 'image',
      creators: [
        {
          address: inputs.creatorWallet || '11111111111111111111111111111111',
          share: 100,
        },
      ],
    },
  };
}

/**
 * Sube los metadatos JSON a IPFS / Arweave / Storage.
 * Incluye integración con Pinata (si existe VITE_PINATA_JWT) y respaldo automático a Data URI.
 */
export async function uploadMetadataToStorage(metadata: MetaplexMetadataJson): Promise<string> {
  try {
    const pinataJwt = import.meta.env.VITE_PINATA_JWT;
    if (pinataJwt) {
      const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${pinataJwt}`
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: { name: `certchain-${metadata.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json` }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.IpfsHash) {
          return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
        }
      }
    }
  } catch (err) {
    console.warn("No se pudo publicar en IPFS/Pinata, utilizando fallback seguro:", err);
  }

  // Fallback seguro de desarrollo/demostración mediante Blob URL
  const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  return URL.createObjectURL(blob);
}

import { API_BASE_URL } from '../config';

export const DEFAULT_ASSET_IMAGE = `${API_BASE_URL}/uploads/default.png`;

export function resolveAssetImage(value: any): string | null {
  if (!value) return null;

  const fixUrl = (urlStr: string): string => {
    const trimmed = urlStr.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${trimmed.replace('ipfs://', '')}`;
    if (trimmed.startsWith('/uploads/')) return `${API_BASE_URL}${trimmed}`;
    if (trimmed.startsWith('uploads/')) return `${API_BASE_URL}/${trimmed}`;
    return trimmed;
  };

  if (typeof value === 'string') {
    const res = fixUrl(value);
    return res || null;
  }

  if (typeof value !== 'object') return null;

  const content = value.content || {};
  const directImage = value.image || value.image_url || value.uri || value.url || null;
  if (typeof directImage === 'string' && directImage.trim()) {
    const res = fixUrl(directImage);
    if (res) return res;
  }

  if (content.links?.image && typeof content.links.image === 'string') {
    const res = fixUrl(content.links.image);
    if (res) return res;
  }

  if (Array.isArray(content.files) && content.files.length > 0) {
    const fileUri = content.files[0]?.uri || content.files[0]?.url || content.files[0]?.link || null;
    if (typeof fileUri === 'string' && fileUri.trim()) {
      const res = fixUrl(fileUri);
      if (res) return res;
    }
  }

  if (content.image && typeof content.image === 'string') {
    const res = fixUrl(content.image);
    if (res) return res;
  }

  return null;
}

