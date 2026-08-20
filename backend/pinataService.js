import pinataSDK from '@pinata/sdk';
import fs from 'fs';

const pinata = new pinataSDK({
  pinataJWTKey: process.env.PINATA_JWT,
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretApiKey: process.env.PINATA_SECRET_API_KEY
});

// Subir imagen física alojada en /uploads a IPFS
export async function uploadImageToIPFS(filePath, fileName) {
  try {
    const readableStreamForFile = fs.createReadStream(filePath);
    const options = { pinataMetadata: { name: fileName } };
    const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error('Error al subir imagen a Pinata:', error);
    throw error;
  }
}

// Subir metadatos JSON del cNFT
export async function uploadMetadataToIPFS(metadataJSON, certId) {
  try {
    const options = { pinataMetadata: { name: `certchain-metadata-${certId}.json` } };
    const result = await pinata.pinJSONToIPFS(metadataJSON, options);
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error('Error al subir metadatos a Pinata:', error);
    throw error;
  }
}