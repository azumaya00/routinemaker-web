/**
 * ローディングスピナーコンポーネント
 * 中央にリングが回るスピナーを表示
 */

export default function LoadingSpinner() {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner" aria-label="読み込み中">
        <div className="loading-spinner-ring"></div>
      </div>
    </div>
  );
}

