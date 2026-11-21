import { BRAND_NAME, BrandLogo } from "@/components/BrandLogo";
import { useEditor } from "@/features/editor/EditorContext";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

export function LandingFooter() {
  const { isSignedIn, user, setAuthOpen, setShortcutsOpen, setLegalTab } =
    useWorkspace();
  const { openDashboard, chooseFile, signOut } = useEditor();

  return (
    <footer id="footer" className="w-full pb-0">
      <div className="flex flex-col gap-10 p-6 md:flex-row md:items-start md:justify-between md:p-12">
        <div className="flex max-w-xs flex-col items-start gap-4">
          <a
            href="#hero"
            className="flex items-center gap-2.5 text-lg font-semibold text-[#f7f8f8]"
          >
            <BrandLogo size={28} />
            <span>{BRAND_NAME}</span>
          </a>
          <p className="text-[14px] leading-relaxed text-[#8a8f98]">
            Edit text, sign forms, hide private details, and share documents
            right in your browser.
          </p>
          <p className="text-xs text-[#62666d]">
            © {new Date().getFullYear()} {BRAND_NAME}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:pr-6">
          <ul role="list" className="flex flex-col gap-2.5">
            <li className="text-xs font-semibold text-[#f7f8f8]">Product</li>
            <li>
              <a
                href="#features"
                className="text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="#how-it-works"
                className="text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                How it works
              </a>
            </li>
            <li>
              <a
                href="#faq"
                className="text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                FAQ
              </a>
            </li>
          </ul>

          <ul role="list" className="flex flex-col gap-2.5">
            <li className="text-xs font-semibold text-[#f7f8f8]">Workspace</li>
            <li>
              <button
                type="button"
                onClick={openDashboard}
                className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                Open dashboard
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => chooseFile(null, true)}
                className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                Upload file
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                Shortcuts
              </button>
            </li>
          </ul>

          <ul role="list" className="flex flex-col gap-2.5">
            <li className="text-xs font-semibold text-[#f7f8f8]">Account</li>
            <li>
              {isSignedIn && user ? (
                <span className="text-sm text-[#8a8f98]">{user.name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                >
                  Sign up
                </button>
              )}
            </li>
            {isSignedIn && (
              <li>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                >
                  Sign out
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={() => setLegalTab("privacy")}
                className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                Privacy Policy
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setLegalTab("terms")}
                className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
              >
                Terms of Service
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Faded dot-matrix footer band */}
      <div className="relative z-0 mt-8 h-32 w-full md:h-44">
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-transparent from-40% to-[#08090a]" />
        <div
          aria-hidden="true"
          className="absolute inset-0 mx-6 bg-[size:14px_14px] text-[#f7f8f8]/10 [background-image:radial-gradient(currentColor_1px,transparent_1px)]"
        />
      </div>
    </footer>
  );
}
