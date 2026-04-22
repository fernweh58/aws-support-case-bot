package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
)

type encryptedBody struct {
	Encrypt string `json:"encrypt"`
}

// Decrypt decrypts a Lark encrypted event body using the Encrypt Key.
// Lark uses AES-256-CBC with SHA256(key) and the first 16 bytes as IV.
func Decrypt(encryptKey string, body []byte) ([]byte, error) {
	var eb encryptedBody
	if err := json.Unmarshal(body, &eb); err != nil {
		return nil, fmt.Errorf("unmarshal encrypted body: %w", err)
	}
	if eb.Encrypt == "" {
		return body, nil // not encrypted
	}

	ciphertext, err := base64.StdEncoding.DecodeString(eb.Encrypt)
	if err != nil {
		return nil, fmt.Errorf("base64 decode: %w", err)
	}

	key := sha256.Sum256([]byte(encryptKey))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	if len(ciphertext) < aes.BlockSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	if len(ciphertext)%aes.BlockSize != 0 {
		return nil, fmt.Errorf("ciphertext not multiple of block size")
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(ciphertext, ciphertext)

	// Remove PKCS7 padding
	padLen := int(ciphertext[len(ciphertext)-1])
	if padLen > aes.BlockSize || padLen == 0 {
		return nil, fmt.Errorf("invalid padding")
	}
	return ciphertext[:len(ciphertext)-padLen], nil
}
