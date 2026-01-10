"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

const termsText = `利用規約

本利用規約（以下、「本規約」といいます。）は、Yuru Labo（ゆるラボ）（以下、「当方」といいます。）が提供するWebサービス（以下、「本サービス」といいます。）の利用条件を定めるものです。ユーザーは、本サービスを利用することにより、本規約に同意したものとみなされます。

第1条（適用）
本規約は、ユーザーと当方との間の本サービスの利用に関わる一切の関係に適用されます。

第2条（本サービスの内容）
本サービスは、当方が提供する各種Web機能および関連情報を、現状有姿のまま提供するものです。
当方は、本サービスの内容について、その完全性、正確性、有用性、特定目的への適合性を保証するものではありません。

第3条（利用条件）
ユーザーは、自己の責任において本サービスを利用するものとします。
本サービスの利用にあたり、ユーザーが使用する端末、通信環境、設定等について、当方は一切の責任を負いません。

第4条（禁止事項）
ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。
・法令または公序良俗に違反する行為
・本サービスの運営を妨害する行為
・不正アクセス、過度な負荷をかける行為
・他のユーザーまたは第三者に不利益、損害、不快感を与える行為
・当方が不適切と判断する行為

第5条（サービスの変更・停止・終了）
当方は、ユーザーへの事前の通知なく、本サービスの内容を変更し、または本サービスの提供を一時的に停止、もしくは終了することがあります。
これによりユーザーに生じた損害について、当方は一切の責任を負いません。

第6条（免責事項）
当方は、本サービスの利用によりユーザーに生じた損害について、当方の故意または重過失による場合を除き、一切の責任を負いません。
本サービスの利用または利用不能により発生した損害についても、当方は責任を負いません。

第7条（知的財産権）
本サービスに含まれる文章、画像、プログラム、その他のコンテンツに関する知的財産権は、当方または正当な権利を有する第三者に帰属します。
ユーザーは、これらを法令で認められた範囲を超えて利用してはなりません。

第8条（利用規約の変更）
当方は、必要と判断した場合には、ユーザーに通知することなく本規約を変更することができます。
変更後の利用規約は、本サービス上に掲載した時点から効力を生じるものとします。

第9条（準拠法および管轄）
本規約の解釈にあたっては、日本法を準拠法とします。
本サービスに関して紛争が生じた場合には、当方の所在地を管轄する裁判所を専属的合意管轄とします。

制定日：2026年1月10日`;

export default function TermsPage() {
  const router = useRouter();
  const { status } = useAuth();

  const { title, body } = useMemo(() => {
    const [firstLine, ...rest] = termsText.split("\n");
    return {
      title: firstLine,
      body: rest.join("\n"),
    };
  }, []);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(status === "authenticated" ? "/routines" : "/");
  };

  return (
    <section className="routine-form-container">
      <button
        type="button"
        className="routine-form-back-btn"
        onClick={handleBack}
      >
        ← 戻る
      </button>
      <h1 className="routine-form-title">{title}</h1>
      <div className="policy-content">{body}</div>
    </section>
  );
}
