# Interest Carry-Trade Arbitrageur

Automated token carry swap bot 🤖 exploits interest rate 💰 **differentials** 24/7.

Interest Carry-Trade Arbitrageur looks for interest rate differentials between lending/borrowing order pairs on Secured Finance. 
It creates a strategy to maximize interest rate differentials, then executes it by borrowing token X, swapping it, and lending token Y for a higher yield (APR).

## Languages

- Rust
- Node

## Getting Started

### Prerequisites

Ensure you have Rust / Node.js installed on your system.


### Installation
1. Clone the repo
2. Change to the project directory
  
## Usage

### Rust

Add `.env` file with the following values:
- `NODE_URL`
- `PRIVATE_KEY`

To start the Rust bot, run the following command in the project directory:

```bash
cargo **run**
```

### Node
To start the Node bot, first install the dependencies:

Add `.env` file with the following values:
- `INFURA_API_KEY`
- `SIGNER_PRIVATE_KEY`

```bash
npm install
npm start
```

