import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var errorMessage: String?
    @State private var isBusy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Sign in with the same account types on parent and child devices. Each person uses their own login.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Section("Email") {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(isSignUp ? .newPassword : .password)
                    Button(isSignUp ? "Create account" : "Sign in") {
                        Task { await submitEmail() }
                    }
                    .disabled(email.isEmpty || password.count < 6 || isBusy)
                    Button(isSignUp ? "Have an account? Sign in" : "Need an account? Create one") {
                        isSignUp.toggle()
                    }
                }

                Section("Apple") {
                    SignInWithAppleButton(.signIn) { request in
                        environment.auth.prepareAppleRequest(request)
                    } onCompletion: { result in
                        Task { await handleApple(result) }
                    }
                    .frame(height: 44)
                    .listRowInsets(EdgeInsets())
                }

                if let errorMessage {
                    Section {
                        ErrorBanner(message: errorMessage)
                    }
                }
            }
            .navigationTitle("ParentLock")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private func submitEmail() async {
        isBusy = true
        defer { isBusy = false }
        do {
            if isSignUp {
                try await environment.auth.signUp(email: email, password: password)
            } else {
                try await environment.auth.signIn(email: email, password: password)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            do {
                try await environment.auth.handleApple(authorization: authorization)
            } catch {
                errorMessage = error.localizedDescription
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }
}
