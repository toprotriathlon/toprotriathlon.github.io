export default {
  props: { error: { type: String, default: "" }, notice: { type: String, default: "" } },
  emits: ["login", "reset"],
  data() {
    return { email: "", password: "", submitting: false };
  },
  methods: {
    async submit() {
      this.submitting = true;
      await Promise.resolve(this.$emit("login", this.email, this.password));
      this.submitting = false;
    },
    forgot() { this.$emit("reset", this.email); },
  },
  template: `
    <div class="admin-login">
      <form class="admin-login-card" @submit.prevent="submit">
        <h1>TO PRO 後台管理</h1>
        <p class="sub">請登入以編輯活動頁面</p>
        <div class="admin-error" v-if="error">{{ error }}</div>
        <div class="admin-notice" v-if="notice">{{ notice }}</div>
        <div class="form-row">
          <label>Email</label>
          <input type="email" v-model="email" required autocomplete="username" />
        </div>
        <div class="form-row">
          <label>密碼</label>
          <input type="password" v-model="password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
          {{ submitting ? '登入中…' : '登入' }}
        </button>
        <button type="button" class="admin-link" @click="forgot">忘記密碼？寄送重設信到上方 Email</button>
      </form>
    </div>
  `,
};
