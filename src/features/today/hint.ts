/**
 * The id linking the capture field to its syntax hint.
 *
 * The hint is rendered at the foot of the board, far from the input it
 * describes, so the two ends need a name they agree on. There is only ever one
 * capture field on screen, which is why a constant is honest here and a
 * generated `useId` would only obscure the connection.
 */
export const CAPTURE_HINT_ID = 'capture-syntax'
