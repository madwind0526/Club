import { useState, type FormEvent } from "react";
import { login } from "../../data/authStore";
import type { PublicMember, ThemeMode } from "../../types/domain";

interface LoginViewProps {
  clubName: string;
  theme: ThemeMode;
  onLoginSuccess: (member: PublicMember) => void;
}

export function LoginView({ clubName, theme, onLoginSuccess }: LoginViewProps) {
  const [knoxId, setKnoxId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await login(knoxId.trim(), password);

      if (!result.ok || !result.member) {
        setError(result.error || "로그인에 실패했습니다.");
        return;
      }

      onLoginSuccess(result.member);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`login-screen ${theme}`}>
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>{clubName}</h1>

        <div className="form-field">
          <label htmlFor="login-knox-id">Knox ID</label>
          <input
            autoFocus
            id="login-knox-id"
            onChange={(event) => setKnoxId(event.target.value)}
            placeholder="Knox ID"
            value={knoxId}
          />
        </div>

        <div className="form-field">
          <label htmlFor="login-password">비밀번호</label>
          <input
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            type="password"
            value={password}
          />
        </div>

        {error && <p className="login-error">{error}</p>}

        <button className="btn btn-primary" disabled={isSubmitting || !knoxId.trim() || !password} type="submit">
          로그인
        </button>
      </form>
    </div>
  );
}
