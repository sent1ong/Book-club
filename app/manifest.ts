import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Book Club 98 - 독서 기록장',
    short_name: 'BookClub98',
    description: '레트로 윈도우 98 스타일 독서/웹툰/오디오드라마 기록 웹 앱',
    start_url: '/',
    display: 'standalone',
    background_color: '#008080',
    theme_color: '#c0c0c0',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
