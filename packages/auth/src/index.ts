export { authConfig, handlers, auth, signIn, signOut } from "./nextauth-config";
export {
  requireAuth,
  requireAdmin,
  requireDoctor,
  requireStaff,
  requireDoctorOwnership,
} from "./middleware";
