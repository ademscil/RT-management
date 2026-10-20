import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera } from '@capacitor/camera';
import { Camera, RefreshCw, X, Check, Image as ImageIcon } from 'lucide-react';
import { Button } from '@simrt/ui-kit';

interface IdCardScannerModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const IdCardScannerModal: React.FC<IdCardScannerModalProps> = ({
  isOpen,
  title,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);

      // Explicitly trigger native OS Camera Permission prompt if on native device (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        try {
          const check = await CapCamera.checkPermissions();
          if (check.camera !== 'granted') {
            const req = await CapCamera.requestPermissions({ permissions: ['camera'] });
            if (req.camera !== 'granted') {
              setCameraError('Izin akses kamera ditolak. Silakan gunakan tombol "Pilih dari Galeri" atau izinkan di pengaturan HP.');
              return;
            }
          }
        } catch (permErr) {
          console.warn('[Camera Permission Check]:', permErr);
        }
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch {
      setCameraError('Kamera tidak dapat diakses. Silakan gunakan tombol "Pilih dari Galeri".');
    }
  }, [facingMode]);

  useEffect(() => {
    if (isOpen && !capturedImageUrl) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, capturedImageUrl, startCamera]);

  if (!isOpen) return null;

  const handleCaptureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setCapturedImageUrl(URL.createObjectURL(blob));
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }
    }, 'image/jpeg', 0.92);
  };

  const handleRetake = () => {
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    setCapturedImageUrl(null);
    setCapturedBlob(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `id_card_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onCapture(files[0]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md sm:max-w-lg bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800 text-white">
          <div>
            <h3 className="text-sm font-bold">{title}</h3>
            <p className="text-[11px] text-teal-400">Posisikan dokumen tegak lurus di dalam bingkai</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (stream) stream.getTracks().forEach((t) => t.stop());
              onClose();
            }}
            aria-label="Tutup Pemindaian KTP"
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport with ID Card cutout overlay */}
        <div className="relative flex-1 bg-black min-h-[300px] flex items-center justify-center overflow-hidden">
          {!capturedImageUrl ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* ID Card Cutout Aspect-Ratio Box (85.6mm : 53.98mm ~ 1.586) */}
              <div className="absolute inset-4 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-full max-w-xs aspect-[1.586] border-2 border-teal-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />

                  <div className="absolute inset-x-0 bottom-2 text-center">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-500/30">
                      BINGKAI KTP / KK
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-xs font-semibold text-slate-200 text-center drop-shadow-md">
                  Hindari pantulan cahaya & bayangan gelap
                </p>
              </div>
            </>
          ) : (
            <div className="w-full h-full p-2 flex items-center justify-center bg-black">
              <img
                src={capturedImageUrl}
                alt="Captured ID"
                className="max-h-full max-w-full rounded-xl object-contain border border-teal-500"
              />
            </div>
          )}

          {cameraError && !capturedImageUrl && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-slate-300">
              <p className="text-xs mb-4">{cameraError}</p>
              <Button
                variant="primary"
                size="md"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4" /> Buka Galeri Dokumen
              </Button>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <input
            id="ktp-gallery-file-input"
            name="ktpFile"
            aria-label="Pilih Foto Dokumen KTP dari Galeri"
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!capturedImageUrl ? (
            <>
              <button
                type="button"
                onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                title="Putar Kamera"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleCaptureFrame}
                className="w-14 h-14 rounded-full border-4 border-white bg-teal-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                title="Pilih dari Galeri"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <Button variant="outline" size="md" className="flex-1" onClick={handleRetake}>
                <RefreshCw className="w-4 h-4" /> Foto Ulang
              </Button>
              <Button variant="primary" size="md" className="flex-1" onClick={handleConfirm}>
                <Check className="w-4 h-4" /> Gunakan Foto Ini
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
