const typeDefs = `
  type Transaction {
    id: ID!
    type: String!
    title: String!
    amount: Float!
    category: String!
    date: String!
    tripId: String
    userId: String
  }

  type Trip {
    id: ID!
    name: String!
    icon: String!
    date: String!
    userId: String
  }

  type Pagination {
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
  }

  type TransactionPage {
    data: [Transaction!]!
    pagination: Pagination!
  }

  type TripPage {
    data: [Trip!]!
    pagination: Pagination!
  }

  type CategoryStat {
    category: String!
    total: Float!
  }

  type Statistics {
    totalIncome: Float!
    totalExpense: Float!
    balance: Float!
    avgExpense: Float!
    transactionCount: Int!
    byCategory: [CategoryStat!]!
  }

  type TripStatistics {
    trip: Trip!
    stats: Statistics!
  }

  type GeneratorStatus {
    running: Boolean!
  }

  type GeneratorResult {
    started: Boolean
    stopped: Boolean
    message: String!
  }

  type Permission {
    id: ID!
    name: String!
    description: String
  }

  type Role {
    id: ID!
    name: String!
    description: String
    permissions: [Permission!]!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: Role!
    isActive: Boolean!
    createdAt: String!
  }

  type AuthResult {
    success: Boolean!
    message: String!
    user: User
    token: String
  }

  type LoginStepResult {
    success: Boolean!
    message: String!
    pendingToken: String
    securityQuestion: String
    user: User
    token: String
  }

  type LogEntry {
    id: ID!
    userId: String
    userEmail: String
    userRole: String
    action: String!
    details: String
    ipAddress: String
    success: Boolean!
    timestamp: String!
  }

  type SuspiciousUser {
    id: ID!
    userId: String!
    userEmail: String!
    userRole: String
    reason: String!
    actionCount: Int!
    detectedAt: String!
    resolved: Boolean!
  }

  type Session {
    id: ID!
    userId: String!
    name: String!
    permissions: [String!]!
    expiresAt: String!
    isRevoked: Boolean!
    ipAddress: String
    createdAt: String!
  }

  type GeneratedToken {
    token: String!
    sessionId: ID!
    name: String!
    permissions: [String!]!
    expiresAt: String!
  }

  type PasswordResetResult {
    success: Boolean!
    message: String!
  }

  type Query {
    transactions(page: Int, limit: Int, tripId: String, type: String, userId: String): TransactionPage!
    transaction(id: ID!): Transaction
    statistics(tripId: String, userId: String): Statistics!
    trips(page: Int, limit: Int, userId: String): TripPage!
    trip(id: ID!): Trip
    tripStatistics(id: ID!, userId: String): TripStatistics!
    generatorStatus: GeneratorStatus!
    users: [User!]!
    user(id: ID!): User
    roles: [Role!]!
    role(id: ID!): Role
    permissions: [Permission!]!
    myPermissions(userId: ID!): [String!]!
    logs(limit: Int): [LogEntry!]!
    suspiciousUsers: [SuspiciousUser!]!
    mySessions: [Session!]!
    allSessions: [Session!]!
    me: User
  }

  type Mutation {
    createTransaction(type: String!, title: String!, amount: Float!, category: String!, date: String!, tripId: String, userId: String): Transaction!
    updateTransaction(id: ID!, type: String!, title: String!, amount: Float!, category: String!, date: String!, tripId: String): Transaction!
    deleteTransaction(id: ID!): Boolean!
    createTrip(name: String!, icon: String): Trip!
    updateTrip(id: ID!, name: String, icon: String): Trip!
    deleteTrip(id: ID!): Boolean!
    startGenerator(batchSize: Int, intervalMs: Int, tripId: String, userId: String): GeneratorResult!
    stopGenerator: GeneratorResult!
    register(name: String!, email: String!, password: String!, role: String, securityQuestion: String, securityAnswer: String): AuthResult!
    login(email: String!, password: String!): LoginStepResult!
    verifyLoginCode(pendingToken: String!, code: String!): LoginStepResult!
    verifySecurityQuestion(pendingToken: String!, answer: String!): LoginStepResult!
    logout: Boolean!
    updateUserRole(userId: ID!, roleName: String!): User!
    deactivateUser(userId: ID!): User!
    resolveFlag(id: ID!): SuspiciousUser!
    revokeSession(sessionId: ID!): Boolean!
    revokeAllSessions: Boolean!
    generateToken(name: String!, permissions: [String!]!, expiresIn: String): GeneratedToken!
    forgotPassword(email: String!): PasswordResetResult!
    resetPassword(token: String!, newPassword: String!): PasswordResetResult!
  }
`;

module.exports = typeDefs;
