"use client";
import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "./icon";

export function PasswordField(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field"><input {...props} type={visible ? "text" : "password"} /><button type="button" className="icon-button" disabled={props.disabled} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} onClick={() => setVisible((value) => !value)}><Icon name="eye" className="size-5" /></button></span>;
}
