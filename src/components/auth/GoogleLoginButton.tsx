"use client";

import { useCallback, useMemo } from "react";

type GoogleLoginButtonProps = {
  fullWidth?: boolean;
};

export function GoogleLoginButton({ fullWidth = false }: GoogleLoginButtonProps) {
  // Google OAuth リダイレクト先（API ベースURLを環境変数から組み立てる）
  const redirectUrl = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    return `${baseUrl}/api/auth/google/redirect`;
  }, []);

  // クリック時に Google 認証へ遷移させる（API 側に処理を委譲）
  const handleClick = useCallback(() => {
    window.location.href = redirectUrl;
  }, [redirectUrl]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`gsi-material-button${fullWidth ? " gsi-material-button--full" : ""}`}
    >
      <div className="gsi-material-button-state" />
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon" aria-hidden="true">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            style={{ display: "block" }}
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            ></path>
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            ></path>
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            ></path>
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            ></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
        </div>
        <span className="gsi-material-button-contents">Google でログイン</span>
        <span style={{ display: "none" }}>Google でログイン</span>
      </div>

      <style jsx>{`
        .gsi-material-button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 46px; /* 「無料で使う」ボタンと高さを揃える */
          border-radius: 20px;
          background-color: #f2f2f2;
          color: #1f1f1f;
          font-family: "Roboto", "Helvetica", "Arial", sans-serif;
          font-size: 16px; /* 「無料で使う」ボタンと同じフォントサイズ */
          font-weight: 500;
          border: none;
          cursor: pointer;
          padding: 0 16px;
          min-width: 200px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          transition: background-color 0.2s ease, box-shadow 0.2s ease,
            transform 0.1s ease;
          text-decoration: none;
        }

        .gsi-material-button--full {
          width: 100%;
        }

        .gsi-material-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
          box-shadow: none;
        }

        .gsi-material-button:not(:disabled):hover {
          background-color: #e6e6e6;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
        }

        .gsi-material-button:not(:disabled):active {
          background-color: #dadada;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14) inset;
          transform: translateY(0.5px);
        }

        .gsi-material-button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.35);
        }

        .gsi-material-button-state {
          position: absolute;
          inset: 0;
          border-radius: 20px;
        }

        .gsi-material-button-content-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          z-index: 1;
        }

        .gsi-material-button-icon {
          display: inline-flex;
          width: 18px;
          height: 18px;
        }

        .gsi-material-button-contents {
          white-space: nowrap;
        }
      `}</style>
    </button>
  );
}
