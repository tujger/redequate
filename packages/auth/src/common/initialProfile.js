export default function initialProfile(user) {
    return {public: user.public, private: user.private};
}
