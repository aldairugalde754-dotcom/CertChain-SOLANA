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
 * Construye el objeto JSON conforme al estándar Metaplex Token Metadata V1.
 */
export function buildCertificateMetadata(inputs: CertificateFormInputs): MetaplexMetadataJson {
  const primaryImage = inputs.images.length > 0 ? inputs.images[0] : 'https://arweave.net/placeholder-certificate-image';

  return {
    name: inputs.nombre,
    symbol: 'CERT',
    description: inputs.descripcion,
    image: primaryImage,
    external_url: 'https://certchain.app',
    attributes: [
      { trait_type: 'Categoría', value: inputs.categoria },
      { trait_type: 'No. de Serie', value: inputs.serie },
      { trait_type: 'Año de Fabricación', value: inputs.anio },
      { trait_type: 'País de Origen', value: inputs.origen },
      { trait_type: 'Valor de Mercado (USD)', value: inputs.valor },
      { trait_type: 'Edición', value: inputs.edicion },
      { trait_type: 'Material Principal', value: inputs.material },
      { trait_type: 'Acabado', value: inputs.acabado },
      { trait_type: 'Garantía', value: inputs.garantia },
      { trait_type: 'Peso', value: inputs.peso },
    ],
    properties: {
      files: inputs.images.map(img => ({ uri: img, type: 'image/png' })),
      category: 'image',
      creators: [
        {
          address: inputs.creatorWallet,
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

