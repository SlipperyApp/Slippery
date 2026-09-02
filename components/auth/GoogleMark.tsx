/** Google's four colour G, drawn inline, on a white chip.
 *
 *  THE FOUR FILLS BELOW ARE GOOGLE'S OWN HEX AND ARE EXEMPT FROM THE THEME.
 *  #4285F4, #34A853, #FBBC05 and #EA4335 are literal here and no token points
 *  at them, which is deliberate rather than an oversight: Google's brand
 *  guidelines permit the four colour G on a white or light surface and the
 *  plain white G on a coloured one, and a monochrome recolouring of the four
 *  colour mark is not one of the permitted forms.
 *
 *  THIS IS THE SECOND EXEMPTION IN THE PRODUCT AND IT IS NOT THE SAME ONE.
 *  #86EFAC profit and #FCA5A5 loss also sit outside every theme block, and
 *  they do so because they MEAN something: a profit that changed colour with
 *  the theme would be a profit the theme could argue with. These four sit
 *  outside it because they belong to somebody else and we are not allowed to
 *  change them. Same rule, opposite reason, and it is worth keeping the two
 *  apart: a future palette pass that swept up every stray hex would be right
 *  to look here and wrong to touch it.
 *
 *  What shipped before was `<Icon name="google">`, and Icon paints every path
 *  with `stroke="currentColor"` and `fill="none"`: the mark came out as four
 *  hairline outlines in whatever ink the button had, which is a modified
 *  Google logo on eight different grounds.
 *
 *  THE CHIP IS WHY IT IS LEGIBLE. All eight themes are dark, the blue arm of
 *  the G measures 3.1:1 on the lightest of them and 2.0:1 on the darkest, and
 *  the mark may not be lightened to fix that. So it sits on a white square,
 *  which is the arrangement Google's own dark sign in button uses, and the
 *  contrast of the mark against its own chip is fixed in every theme.
 *
 *  The paths are Google's own, at their 48 unit viewBox, so the proportions
 *  are the supplied ones rather than a redraw. */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <span className="gbtn__chip" aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size} focusable="false" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
        />
        <path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"
        />
        <path
          fill="#FBBC05"
          d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7Z"
        />
        <path
          fill="#EA4335"
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
        />
      </svg>
    </span>
  );
}
