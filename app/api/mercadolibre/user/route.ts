
import { simpleMLCall } from "../simple-base"

export async function GET(_request: Request) {
  return simpleMLCall("/users/me")
}